
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

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

        const existing = await prisma.recurringShift.findFirst({
            where: { id, tenantKey }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Recurring shift not found' }, { status: 404 });
        }

        await prisma.recurringShift.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting recurring shift:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');
        if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

        const id = parseInt(params.id);
        const body = await request.json();

        const existing = await prisma.recurringShift.findFirst({
            where: { id, tenantKey }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Recurring shift not found' }, { status: 404 });
        }

        const updated = await prisma.recurringShift.update({
            where: { id },
            data: {
                start_time: body.start_time,
                end_time: body.end_time,
                postazione: body.postazione,
                dayOfWeek: body.dayOfWeek ? parseInt(body.dayOfWeek) : existing.dayOfWeek,
                // staffId usually doesn't change for a shift edit, but can be added if needed
            }
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating recurring shift:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
