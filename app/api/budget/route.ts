
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

        const whereClause: any = { tenantKey };
        if (start && end) {
            whereClause.data = {
                gte: start,
                lte: end
            };
        }

        const budget = await prisma.budget.findMany({
            where: whereClause,
            orderBy: { data: 'asc' },
        });

        return NextResponse.json(budget);
    } catch (error) {
        console.error('Error fetching budget:', error);
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

        // Upsert based on data + tenantKey
        // Prisma upsert requires unique input.
        // We added @@unique([data, tenantKey]) to schema.

        const budget = await prisma.budget.upsert({
            where: {
                // @ts-ignore
                data_tenantKey: {
                    data: body.data,
                    tenantKey: tenantKey
                }
            },
            update: {
                value: parseFloat(body.value) || 0,
                hoursLunch: parseFloat(body.hoursLunch) || 0,
                hoursDinner: parseFloat(body.hoursDinner) || 0,
                valueLunch: parseFloat(body.valueLunch) || 0,
                valueDinner: parseFloat(body.valueDinner) || 0,
            },
            create: {
                data: body.data,
                value: parseFloat(body.value) || 0,
                hoursLunch: parseFloat(body.hoursLunch) || 0,
                hoursDinner: parseFloat(body.hoursDinner) || 0,
                valueLunch: parseFloat(body.valueLunch) || 0,
                valueDinner: parseFloat(body.valueDinner) || 0,
                tenantKey: tenantKey,
            },
        });

        return NextResponse.json(budget);
    } catch (error) {
        console.error('Error saving budget:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
