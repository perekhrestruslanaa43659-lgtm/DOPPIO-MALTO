
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

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

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error approving request:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
