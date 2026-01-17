
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
            whereClause.weekStart = {
                gte: start,
                lte: end
            };
        } else if (start) {
            whereClause.weekStart = { gte: start };
        }

        const forecast = await prisma.forecastRow.findMany({
            where: whereClause,
            orderBy: { weekStart: 'desc' },
        });

        return NextResponse.json(forecast);
    } catch (error) {
        console.error('Error fetching forecast:', error);
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
        const rows = body.rows || [];

        // Simple approach: create new rows. 
        // Logic for updates depends on frontend sending IDs or not.
        // If IDs are present, update. Else create.

        const results = [];
        for (const row of rows) {
            let item;

            // 1. Try to find existing by ID (if provided)
            if (row.id) {
                const existing = await prisma.forecastRow.findFirst({ where: { id: row.id, tenantKey } });
                if (existing) {
                    item = await prisma.forecastRow.update({
                        where: { id: row.id },
                        data: {
                            weekStart: row.weekStart,
                            data: typeof row.data === 'string' ? row.data : JSON.stringify(row.data),
                        }
                    });
                }
            }

            // 2. If no ID or not found by ID, try to find by weekStart (prevent duplicates)
            if (!item && row.weekStart) {
                const existingByWeek = await prisma.forecastRow.findFirst({
                    where: {
                        weekStart: row.weekStart,
                        tenantKey
                    }
                });

                if (existingByWeek) {
                    item = await prisma.forecastRow.update({
                        where: { id: existingByWeek.id },
                        data: {
                            data: typeof row.data === 'string' ? row.data : JSON.stringify(row.data),
                        }
                    });
                }
            }

            // 3. If still not found, create new
            if (!item) {
                item = await prisma.forecastRow.create({
                    data: {
                        weekStart: row.weekStart,
                        data: typeof row.data === 'string' ? row.data : JSON.stringify(row.data),
                        tenantKey,
                    }
                });
            }
            results.push(item);
        }

        return NextResponse.json({ rows: results });
    } catch (error) {
        console.error('Error saving forecast:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
