
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');

        if (!tenantKey) {
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const id = parseInt(params.id);

        const existing = await prisma.unavailability.findFirst({
            where: { id, tenantKey }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Unavailability not found' }, { status: 404 });
        }

        await prisma.unavailability.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting unavailability:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
