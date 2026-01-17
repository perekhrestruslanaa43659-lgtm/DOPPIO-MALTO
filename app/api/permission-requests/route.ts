
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
                        tipo: 'TOTALE',
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
