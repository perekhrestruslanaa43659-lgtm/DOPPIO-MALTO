
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
                status: 'REJECTED',
                adminResponse: body.adminResponse,
                processedAt: new Date(),
            }
        });

        if (updated.Staff?.email) {
            await sendRequestStatusEmail(
                updated.Staff.email,
                updated.Staff.nome,
                updated.tipo,
                'REJECTED',
                updated.adminResponse || null,
                tenantKey
            );
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error rejecting request:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
