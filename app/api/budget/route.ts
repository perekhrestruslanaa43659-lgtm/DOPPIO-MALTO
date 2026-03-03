
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

        // Check if exists first (to avoid dependency on compound key naming 'data_tenantKey')
        const existing = await prisma.budget.findFirst({
            where: {
                data: body.data,
                tenantKey: tenantKey
            }
        });

        let budget;
        const payload = {
            value: parseFloat(body.value) || 0,
            hoursLunch: parseFloat(body.hoursLunch) || 0,
            hoursDinner: parseFloat(body.hoursDinner) || 0,
            valueLunch: parseFloat(body.valueLunch) || 0,
            valueDinner: parseFloat(body.valueDinner) || 0,

            // New Fields
            hoursLunchKitchen: parseFloat(body.hoursLunchKitchen) || 0,
            hoursDinnerKitchen: parseFloat(body.hoursDinnerKitchen) || 0,
            hoursLunchHall: parseFloat(body.hoursLunchHall) || 0,
            hoursDinnerHall: parseFloat(body.hoursDinnerHall) || 0,

            // Real Data
            realValueLunch: parseFloat(body.realValueLunch) || 0,
            realValueDinner: parseFloat(body.realValueDinner) || 0,
            realCoversLunch: parseInt(body.realCoversLunch) || 0,
            realCoversDinner: parseInt(body.realCoversDinner) || 0,
            budgetCoversLunch: parseInt(body.budgetCoversLunch) || 0,
            budgetCoversDinner: parseInt(body.budgetCoversDinner) || 0,
        };

        if (existing) {
            budget = await prisma.budget.update({
                where: { id: existing.id },
                data: payload
            });
        } else {
            budget = await prisma.budget.create({
                data: {
                    data: body.data,
                    tenantKey: tenantKey,
                    ...payload
                }
            });
        }

        return NextResponse.json(budget);
    } catch (error) {
        console.error('Error saving budget:', error);
        // Log detailed error
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
