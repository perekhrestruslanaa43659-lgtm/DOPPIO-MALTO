
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');
        if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

        const body = await request.json();

        // Support single or batch create if arrays are passed? 
        // Existing logic in /route.ts supported array of days.

        const days = Array.isArray(body.daysOfWeek) ? body.daysOfWeek : (body.dayOfWeek ? [parseInt(body.dayOfWeek)] : []);

        // If logic comes from "Add" modal, it might pass "daysOfWeek" array.
        // Let's verify what the client sends.
        // Client in FixedShiftsPage: 
        // addRecurringShift({ ...newShift }) where newShift has daysOfWeek: number[]

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
                    startWeek: body.startWeek ? parseInt(body.startWeek) : null,
                    endWeek: body.endWeek ? parseInt(body.endWeek) : null,
                    startYear: body.startYear ? parseInt(body.startYear) : null,
                    endYear: body.endYear ? parseInt(body.endYear) : null,
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
