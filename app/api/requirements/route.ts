
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

        console.log(`📝 Saving ${rows.length} coverage rows for week ${weekStart}`);

        // Use a single transaction with optimized operations
        await prisma.$transaction(async (tx) => {
            // Delete existing for this week
            const deleted = await tx.coverageRow.deleteMany({
                where: { weekStart, tenantKey }
            });
            console.log(`🗑️  Deleted ${deleted.count} existing rows`);

            // Create all new rows in one operation (much faster than loop)
            if (rows.length > 0) {
                const created = await tx.coverageRow.createMany({
                    data: rows.map(row => ({
                        weekStart,
                        station: row.station,
                        frequency: row.frequency || '',
                        slots: JSON.stringify(row.slots || {}),
                        extra: JSON.stringify(row.extra || {}),
                        tenantKey
                    }))
                });
                console.log(`✅ Created ${created.count} new rows`);
            }
        }, {
            maxWait: 10000, // Maximum time to wait for transaction to start (10s)
            timeout: 20000, // Maximum time for transaction to complete (20s)
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('❌ Error saving coverage:', error);
        return NextResponse.json({
            error: 'Error saving coverage',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
