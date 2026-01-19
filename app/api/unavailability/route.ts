
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
        const start = searchParams.get('startDate');
        const end = searchParams.get('endDate');

        const whereClause: any = { tenantKey };
        if (start && end) {
            whereClause.data = {
                gte: start,
                lte: end,
            };
        }

        const items = await prisma.unavailability.findMany({
            where: whereClause,
            include: { staff: true }, // Include staff info like name
            orderBy: { data: 'asc' },
        });

        // Map to format if needed, but returning as is is usually fine
        return NextResponse.json(items);
    } catch (error) {
        console.error('Error fetching unavailability:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');

        if (!tenantKey) {
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const body = await request.json();

        const item = await prisma.unavailability.create({
            data: {
                staffId: parseInt(body.staffId),
                data: body.data,
                tipo: body.tipo,
                reason: body.reason,
                start_time: body.start_time,
                end_time: body.end_time,
                tenantKey,
            },
        });

        return NextResponse.json(item);
    } catch (error) {
        console.error('Error creating unavailability:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
