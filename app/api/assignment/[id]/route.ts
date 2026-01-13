
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');

        if (!tenantKey) {
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const id = parseInt(params.id);
        const body = await request.json();

        // Verify ownership
        const existing = await prisma.assignment.findFirst({
            where: { id, tenantKey }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        const assignment = await prisma.assignment.update({
            where: { id },
            data: {
                data: body.data,
                staffId: body.staffId ? parseInt(body.staffId) : undefined,
                shiftTemplateId: body.shiftTemplateId ? parseInt(body.shiftTemplateId) : undefined,
                start_time: body.start_time,
                end_time: body.end_time,
                status: body.status,
                postazione: body.postazione,
            },
        });

        return NextResponse.json(assignment);
    } catch (error) {
        console.error('Error updating assignment:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

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

        const existing = await prisma.assignment.findFirst({
            where: { id, tenantKey }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        await prisma.assignment.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting assignment:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
