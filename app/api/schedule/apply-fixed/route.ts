
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');
        if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

        const { year, week, overwrite } = await request.json();

        if (!year || !week) {
            return NextResponse.json({ error: 'Year and Week required' }, { status: 400 });
        }

        // 1. Calculate Date Range for Week (ISO Week approximation)
        // 4th Jan is always in week 1
        const d = new Date(Date.UTC(year, 0, 4));
        const day = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() - day + 1); // Monday of Week 1
        d.setUTCDate(d.getUTCDate() + (week - 1) * 7); // Monday of Week W

        const monday = d;

        const daysDetails = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(monday);
            date.setUTCDate(monday.getUTCDate() + i);
            daysDetails.push({
                dateObj: date,
                dateStr: date.toISOString().slice(0, 10),
                dayOfWeek: i + 1 // 1=Mon .. 7=Sun
            });
        }

        const startDateStr = daysDetails[0].dateStr;
        const endDateStr = daysDetails[6].dateStr;

        // 2. Fetch Fixed Shifts valid for this week
        const fixedShifts = await (prisma as any).recurringShift.findMany({
            where: {
                tenantKey,
                // Valid for this week
                OR: [
                    { startWeek: null },
                    { startWeek: { lte: week } }
                ],
                // AND valid endWeek
                AND: [
                    {
                        OR: [
                            { endWeek: null },
                            { endWeek: { gte: week } }
                        ]
                    },
                    {
                        OR: [
                            { startYear: null },
                            { startYear: { lte: year } }
                        ]
                    },
                    {
                        OR: [
                            { endYear: null },
                            { endYear: { gte: year } }
                        ]
                    }
                ]
            }
        });

        // 3. Apply Logic
        const results = [];

        for (const dayDetail of daysDetails) {
            // Find shifts for this day of week
            const relevantShifts = fixedShifts.filter((s: any) => s.dayOfWeek === dayDetail.dayOfWeek);

            for (const fixed of relevantShifts) {
                // Find existing real shift
                const existing = await (prisma as any).shift.findFirst({
                    where: {
                        tenantKey,
                        staffId: fixed.staffId,
                        date: dayDetail.dateStr
                    }
                });

                if (existing) {
                    // Update
                    await (prisma as any).shift.update({
                        where: { id: existing.id },
                        data: {
                            start_time: fixed.start_time,
                            end_time: fixed.end_time,
                            shiftTemplateId: fixed.shiftTemplateId,
                            postazione: fixed.postazione
                        }
                    });
                    results.push({ action: 'updated', id: existing.id, date: dayDetail.dateStr, staffId: fixed.staffId });
                } else {
                    // Create
                    const created = await (prisma as any).shift.create({
                        data: {
                            staffId: fixed.staffId,
                            tenantKey,
                            date: dayDetail.dateStr,
                            start_time: fixed.start_time,
                            end_time: fixed.end_time,
                            shiftTemplateId: fixed.shiftTemplateId,
                            postazione: fixed.postazione
                        }
                    });
                    results.push({ action: 'created', id: created.id, date: dayDetail.dateStr, staffId: fixed.staffId });
                }
            }
        }

        return NextResponse.json({ success: true, processed: results.length, details: results });
    } catch (error) {
        console.error('Error applying fixed shifts:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
