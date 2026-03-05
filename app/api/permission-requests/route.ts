
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

        const where: any = {
            Staff: {
                tenantKey: tenantKey
            }
        };

        if (status) {
            where.status = status;
        }

        const requests = await (prisma as any).permissionRequest.findMany({
            where,
            include: {
                Staff: true, // Include staff details
                User: { select: { name: true, surname: true } } // Include processor details
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

        const req = await (prisma as any).permissionRequest.create({
            data: {
                staffId: parseInt(body.staffId),
                data: body.data,
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

        if (status === 'APPROVED') {
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

            if (body.endDate && body.endDate > body.data) {
                // Period: Create for range
                let curr = new Date(body.data);
                const end = new Date(body.endDate);
                while (curr <= end) {
                    await createUnavail(curr.toISOString().split('T')[0], null, null);
                    curr.setDate(curr.getDate() + 1);
                }
            } else if (body.startTime && body.endTime) {
                // Hourly
                await createUnavail(body.data, body.startTime, body.endTime);
            } else {
                // Single Day
                await createUnavail(body.data, null, null);
            }
        }

        return NextResponse.json(req);
    } catch (error) {
        console.error('Error creating permission request:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');
        const userRole = (request.headers.get('x-user-role') || '').toUpperCase();

        if (!tenantKey) {
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const isAdmin = userRole === 'ADMIN' || userRole === 'MANAGER' || userRole === 'OWNER';
        if (!isAdmin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await request.json();
        const { ids } = body;

        if (!ids || !Array.isArray(ids)) {
            return NextResponse.json({ error: 'Array of ids required' }, { status: 400 });
        }

        // 1. Fetch all requests to check status and handle cleanup
        const requestsToDelete = await (prisma as any).permissionRequest.findMany({
            where: {
                id: { in: ids },
                Staff: { tenantKey }
            }
        });

        const deletedIds = requestsToDelete.map((r: any) => r.id);

        // 2. Cleanup Unavailability/Availability for approved requests
        for (const req of requestsToDelete) {
            if (req.status === 'APPROVED') {
                const datesAffected = [];
                if (req.endDate && req.endDate > req.data) {
                    let curr = new Date(req.data);
                    const end = new Date(req.endDate);
                    while (curr <= end) {
                        datesAffected.push(curr.toISOString().split('T')[0]);
                        curr.setDate(curr.getDate() + 1);
                    }
                } else {
                    datesAffected.push(req.data);
                }

                if (req.tipo === 'DISPONIBILITA') {
                    await (prisma as any).availability.deleteMany({
                        where: {
                            staffId: req.staffId,
                            date: { in: datesAffected },
                            tenantKey
                        }
                    });
                } else {
                    await (prisma as any).unavailability.deleteMany({
                        where: {
                            staffId: req.staffId,
                            data: { in: datesAffected },
                            tenantKey
                        }
                    });
                }
            }
        }

        // 3. Delete requests
        await (prisma as any).permissionRequest.deleteMany({
            where: {
                id: { in: deletedIds }
            }
        });

        return NextResponse.json({ success: true, count: deletedIds.length });
    } catch (error) {
        console.error('Error in bulk delete permission requests:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
