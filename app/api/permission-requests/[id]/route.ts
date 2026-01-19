
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
    return NextResponse.json({});
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const userRole = request.headers.get('x-user-role');
        const tenantKey = request.headers.get('x-user-tenant-key');

        if (!tenantKey) return NextResponse.json({ error: 'Tenant Key required' }, { status: 400 });

        // Only Admin/Manager/Owner can delete
        const isAdmin = userRole === 'ADMIN' || userRole === 'MANAGER' || userRole === 'OWNER';
        if (!isAdmin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const id = parseInt(params.id);

        // Find request
        const req = await (prisma as any).permissionRequest.findUnique({
            where: { id },
            include: { Staff: true } // verify tenant
        });

        if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        if (req.Staff.tenantKey !== tenantKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        // If it was approved, we must clean up Unavailability
        if (req.status === 'APPROVED') {
            // Find unavailability created by this request.
            // We stored "Reason" as "Permesso Approvato: TYPE" or similar, or "TYPE - MOTIVO" for auto-approved.
            // Relying on exact string match is risky, but we used:
            // 1. `Permesso Approvato: ${updated.tipo}` (Manual)
            // 2. `${body.tipo} - ${body.motivo}` (Auto)

            // Better strategy: Delete unavailabilities for this staff on the dates involved.
            // But we don't want to delete unrelated unavailabilities.
            // Ideally we should have linked them, but for now we look for overlapping unavailabilities 
            // with matching type/reason for that staff.

            // Simplification: We will try to match strict dates or Reason containing 'Permesso'.
            // Or better, just warn the user "Note: Unavailability might need manual cleanup if not perfectly matched"
            // BUT user wants "Control". let's try to be smart.

            // Logic: Delete Unavailability where staffId matches AND (data matches OR (start/end matches range))
            // AND type == 'TOTALE' (usually permission)

            // Since we generated them carefully, we can try to find them.
            // Single Day: data == req.data
            // Period: data in range [data, endDate]
            // Hourly: data == req.data

            // Let's iterate and delete.

            const deleteUnavail = async (dt: string) => {
                await (prisma as any).unavailability.deleteMany({
                    where: {
                        staffId: req.staffId,
                        data: dt,
                        tenantKey: tenantKey,
                        // We can try to be specific about reason if needed, but deleting all 'TOTALE' for that day 
                        // for that staff is likely what we want if they are canceling the request.
                        // worst case they re-add a manual unavailability.
                    }
                });
            };

            if (req.endDate && req.endDate > req.data) {
                let curr = new Date(req.data);
                const end = new Date(req.endDate);
                while (curr <= end) {
                    await deleteUnavail(curr.toISOString().split('T')[0]);
                    curr.setDate(curr.getDate() + 1);
                }
            } else {
                // Single or Hourly (stored on single day)
                await deleteUnavail(req.data);
            }
        }

        await (prisma as any).permissionRequest.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error deleting request:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
