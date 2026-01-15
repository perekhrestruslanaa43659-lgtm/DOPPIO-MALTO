
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');

        if (!tenantKey) {
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const start = searchParams.get('start');
        const end = searchParams.get('end');

        if (!start || !end) {
            return NextResponse.json({ error: 'Start and End dates required' }, { status: 400 });
        }

        const assignments = await prisma.assignment.findMany({
            where: {
                tenantKey,
                data: {
                    gte: start,
                    lte: end,
                },
            },
            include: {
                shiftTemplate: true,
            },
        });

        return NextResponse.json(assignments);
    } catch (error) {
        console.error('Error fetching schedule:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');
        if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

        const { searchParams } = new URL(request.url);
        const start = searchParams.get('start');
        const end = searchParams.get('end');

        if (!start || !end) {
            return NextResponse.json({ error: 'Start and End dates required' }, { status: 400 });
        }

        const deleted = await prisma.assignment.deleteMany({
            where: {
                tenantKey,
                data: {
                    gte: start,
                    lte: end,
                },
            },
        });

        return NextResponse.json(deleted);
    } catch (error) {
        console.error('Error clearing schedule:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
