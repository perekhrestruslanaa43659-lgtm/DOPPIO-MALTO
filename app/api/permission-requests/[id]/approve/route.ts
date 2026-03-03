
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendRequestStatusEmail } from '@/lib/email';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');
        if (!tenantKey) return NextResponse.json({ error: 'Tenant Key required' }, { status: 400 });

        const id = parseInt(params.id);
        const body = await request.json();

        // Verify request exists and belongs to tenant
        const existing = await (prisma as any).permissionRequest.findFirst({
            where: {
                id,
                Staff: { tenantKey }
            }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        const updated = await (prisma as any).permissionRequest.update({
            where: { id },
            data: {
                status: 'APPROVED',
                adminResponse: body.adminResponse,
                processedAt: new Date(),
                // processedBy: userId (if we had userId from token here easily, likely in header?)
                // If middleware passes x-user-id, we can use it.
            }
        });

        if (updated.tipo === 'DISPONIBILITA') {
            // Helper to create availability
            const createAvail = async (dt: string, st: string, et: string) => {
                await (prisma as any).availability.create({
                    data: {
                        staffId: updated.staffId,
                        date: dt,
                        startTime: st,
                        endTime: et,
                        tenantKey: tenantKey
                    }
                });
            };

            if (updated.endDate && updated.endDate > updated.data) {
                // Period
                let curr = new Date(updated.data);
                const end = new Date(updated.endDate);
                while (curr <= end) {
                    await createAvail(curr.toISOString().split('T')[0], '00:00', '23:59');
                    curr.setDate(curr.getDate() + 1);
                }
            } else if (updated.startTime && updated.endTime) {
                // Hourly
                await createAvail(updated.data, updated.startTime, updated.endTime);
            } else {
                // Single Day full
                await createAvail(updated.data, '00:00', '23:59');
            }
        } else {
            // Helper to create unavail
            const createUnavail = async (dt: string, st: string | null, et: string | null) => {
                await (prisma as any).unavailability.create({
                    data: {
                        staffId: updated.staffId,
                        data: dt,
                        tipo: (st && et) ? 'PARZIALE' : 'TOTALE',
                        reason: `Permesso Approvato: ${updated.tipo}`,
                        start_time: st,
                        end_time: et,
                        tenantKey: tenantKey
                    }
                });
            };

            if (updated.endDate && updated.endDate > updated.data) {
                // Period
                let curr = new Date(updated.data);
                const end = new Date(updated.endDate);
                while (curr <= end) {
                    await createUnavail(curr.toISOString().split('T')[0], null, null);
                    curr.setDate(curr.getDate() + 1);
                }
            } else if (updated.startTime && updated.endTime) {
                // Hourly
                await createUnavail(updated.data, updated.startTime, updated.endTime);
            } else {
                // Single Day
                await createUnavail(updated.data, null, null);
            }
        }

        if (updated.Staff?.email) {
            await sendRequestStatusEmail(
                updated.Staff.email,
                updated.Staff.nome,
                updated.tipo,
                'APPROVED',
                updated.adminResponse || null,
                tenantKey
            );
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error approving request:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
