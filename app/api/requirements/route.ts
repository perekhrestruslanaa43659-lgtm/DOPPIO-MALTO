
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const tenantKey = request.headers.get('x-user-tenant-key');

    if (!date) {
        return NextResponse.json({ error: 'Date required' }, { status: 400 });
    }
    if (!tenantKey) {
        return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
    }

    try {
        const rows = await prisma.coverageRow.findMany({
            where: {
                weekStart: date,
                tenantKey
            }
        });
        return NextResponse.json(rows);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Error fetching coverage' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const tenantKey = request.headers.get('x-user-tenant-key');
    if (!tenantKey) {
        return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
    }

    try {
        const body = await request.json();
        const { weekStart, rows } = body;

        if (!weekStart || !Array.isArray(rows)) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }

        // Transaction to update/create
        await prisma.$transaction(async (tx) => {
            // Delete existing for this week to ensure clean save/update
            await tx.coverageRow.deleteMany({
                where: { weekStart, tenantKey }
            });

            // Create new
            for (const row of rows) {
                await tx.coverageRow.create({
                    data: {
                        weekStart,
                        station: row.station,
                        frequency: row.frequency || '',
                        slots: JSON.stringify(row.slots || {}),
                        extra: JSON.stringify(row.extra || {}),
                        tenantKey
                    }
                });
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Error saving coverage' }, { status: 500 });
    }
}
