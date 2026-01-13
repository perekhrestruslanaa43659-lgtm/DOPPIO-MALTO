
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');

        if (!tenantKey) {
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const body = await request.json();

        const assignment = await prisma.assignment.create({
            data: {
                data: body.data,
                staffId: parseInt(body.staffId),
                shiftTemplateId: body.shiftTemplateId ? parseInt(body.shiftTemplateId) : null,
                start_time: body.start_time,
                end_time: body.end_time,
                status: body.status || false,
                postazione: body.postazione,
                tenantKey: tenantKey,
            },
        });

        return NextResponse.json(assignment);
    } catch (error) {
        console.error('Error creating assignment:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
