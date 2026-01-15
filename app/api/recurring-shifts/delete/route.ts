
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');
        if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

        const body = await request.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID required' }, { status: 400 });
        }

        const existing = await prisma.recurringShift.findFirst({
            where: { id: parseInt(id), tenantKey }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Recurring shift not found' }, { status: 404 });
        }

        await prisma.recurringShift.delete({
            where: { id: parseInt(id) },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting recurring shift:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
