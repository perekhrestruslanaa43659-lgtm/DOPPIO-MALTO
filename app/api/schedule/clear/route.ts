
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
    return NextResponse.json({});
}

export async function POST(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');
        if (!tenantKey) {
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const body = await request.json();
        const { start, end } = body;

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
    } catch (error: any) {
        console.error('Error clearing schedule:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
