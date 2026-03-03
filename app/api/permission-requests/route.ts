
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');

        if (!tenantKey) {
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');

        const userRole = (request.headers.get('x-user-role') || '').toUpperCase();
        const userEmail = request.headers.get('x-user-email');
        const isAdmin = userRole === 'ADMIN' || userRole === 'MANAGER' || userRole === 'OWNER';

        const where: any = {
            Staff: {
                tenantKey: tenantKey
            }
        };

        // For non-admin users, filter to only their own requests using their staff record
        if (!isAdmin && userEmail) {
            const myStaff = await prisma.staff.findFirst({
                where: { email: userEmail, tenantKey }
            });
            if (myStaff) {
                where.staffId = myStaff.id;
            } else {
                // No staff record found for this user — return empty
                return NextResponse.json([]);
            }
        }

        if (status) {
            where.status = status;
        }

        const requests = await (prisma as any).permissionRequest.findMany({
            where,
            include: {
                Staff: true,
                User: { select: { name: true, surname: true } }
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(requests);
    } catch (error) {
        console.error('Error fetching permission requests:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}


export async function POST(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');

        if (!tenantKey) {
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const body = await request.json();

        // Verify staff belongs to tenant
        const staff = await prisma.staff.findFirst({
            where: { id: parseInt(body.staffId), tenantKey }
        });

        if (!staff) {
            return NextResponse.json({ error: 'Staff not found or access denied' }, { status: 403 });
        }

        const userRole = request.headers.get('x-user-role');
        const userId = request.headers.get('x-user-id');
        const isAdmin = userRole === 'ADMIN' || userRole === 'MANAGER' || userRole === 'OWNER';
        const status = isAdmin ? 'APPROVED' : 'PENDING';

        const dates = body.dates || [body.data]; // Support both new array and old single date
        const createdRequests = [];

        for (const dateStr of dates) {
            // Check if already exists for this staff and date
            const existing = await (prisma as any).permissionRequest.findFirst({
                where: {
                    staffId: parseInt(body.staffId),
                    data: dateStr,
                    tipo: body.tipo
                }
            });

            if (existing) {
                console.log(`Skipping duplicate request for ${dateStr}`);
                continue;
            }

            const req = await (prisma as any).permissionRequest.create({
                data: {
                    staffId: parseInt(body.staffId),
                    data: dateStr,
                    endDate: body.endDate,
                    startTime: body.startTime,
                    endTime: body.endTime,
                    tipo: body.tipo,
                    motivo: body.motivo,
                    dettagli: body.dettagli,
                    status: status,
                    updatedAt: new Date(),
                    processedBy: isAdmin && userId ? parseInt(userId) : null,
                    processedAt: isAdmin ? new Date() : null,
                    adminResponse: isAdmin ? 'Auto-approvata (Creata da Admin)' : null
                },
            });
            createdRequests.push(req);

            if (status === 'APPROVED') {
                if (body.tipo === 'DISPONIBILITA') {
                    // Helper to create availability
                    const createAvail = async (dt: string, st: string, et: string) => {
                        await (prisma as any).availability.create({
                            data: {
                                staffId: parseInt(body.staffId),
                                date: dt,
                                startTime: st,
                                endTime: et,
                                tenantKey: tenantKey
                            }
                        });
                    };

                    if (body.endDate && body.endDate > dateStr) {
                        // Period logic (only if dates has single entry basically, otherwise multi-date implies single days)
                        // But if user selects multiple dates AND period... it's ambiguous. 
                        // Frontend 'PERIODO' mode uses single Start/End. 'GIORNALIERO' uses multi-select.
                        // So if dates.length > 1, assume simple single days.
                        await createAvail(dateStr, '00:00', '23:59');
                    } else if (body.startTime && body.endTime) {
                        // Hourly
                        await createAvail(dateStr, body.startTime, body.endTime);
                    } else {
                        // Single Day full
                        await createAvail(dateStr, '00:00', '23:59');
                    }
                } else {
                    // Helper to create unavail
                    const createUnavail = async (dt: string, st: string | null, et: string | null) => {
                        await (prisma as any).unavailability.create({
                            data: {
                                staffId: parseInt(body.staffId),
                                data: dt,
                                tipo: (st && et) ? 'PARZIALE' : 'TOTALE',
                                reason: `${body.tipo} - ${body.motivo}`,
                                start_time: st,
                                end_time: et,
                                tenantKey: tenantKey
                            }
                        });
                    };

                    if (body.endDate && body.endDate > dateStr) {
                        // Period
                        let curr = new Date(dateStr);
                        const end = new Date(body.endDate);
                        while (curr <= end) {
                            await createUnavail(curr.toISOString().split('T')[0], null, null);
                            curr.setDate(curr.getDate() + 1);
                        }
                    } else if (body.startTime && body.endTime) {
                        // Hourly
                        await createUnavail(dateStr, body.startTime, body.endTime);
                    } else {
                        // Single Day
                        await createUnavail(dateStr, null, null);
                    }
                }
            }
        }

        return NextResponse.json(createdRequests.length === 1 ? createdRequests[0] : createdRequests);
    } catch (error) {
        console.error('Error creating permission request:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
