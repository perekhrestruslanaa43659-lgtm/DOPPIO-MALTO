
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

        const items = await prisma.recurringShift.findMany({
            where: { tenantKey },
            include: {
                staff: true,
                shiftTemplate: true
            },
        });

        return NextResponse.json(items);
    } catch (error) {
        console.error('Error fetching recurring shifts:', error);
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

        // Check if there's already a recurring shift for this staff/day?
        // Maybe allow multiple.

        const days = Array.isArray(body.dayOfWeek) ? body.dayOfWeek : [parseInt(body.dayOfWeek)];

        const results = [];
        for (const day of days) {
            const item = await prisma.recurringShift.create({
                data: {
                    staffId: parseInt(body.staffId),
                    dayOfWeek: parseInt(day),
                    start_time: body.start_time,
                    end_time: body.end_time,
                    shiftTemplateId: body.shiftTemplateId ? parseInt(body.shiftTemplateId) : null,
                    postazione: body.postazione,
                    tenantKey,
                },
            });
            results.push(item);
        }

        return NextResponse.json(results);
    } catch (error) {
        console.error('Error creating recurring shift:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
