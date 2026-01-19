
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');

        if (!tenantKey) {
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const result = await prisma.unavailability.deleteMany({
            where: { tenantKey },
        });

        return NextResponse.json({
            success: true,
            deleted: result.count,
            message: `Eliminate ${result.count} assenze`
        });
    } catch (error) {
        console.error('Error deleting all unavailability:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
