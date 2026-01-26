
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ShiftEngine } from '@/lib/shift-engine/engine';
import { EngineContext } from '@/lib/shift-engine/types';
import { addDays, subDays } from 'date-fns';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const tenantKey = searchParams.get('tenantKey');
    const start = searchParams.get('start'); // YYYY-MM-DD
    const end = searchParams.get('end');     // YYYY-MM-DD

    if (!tenantKey || !start || !end) {
        return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    try {
        // 1. Fetch Data
        // Need assignments for the window + previous days for history checks
        const lookbackStart = subDays(new Date(start), 2).toISOString().split('T')[0];

        const [staffList, assignments, unavailabilities, constraints, coverageRows] = await Promise.all([
            prisma.staff.findMany({ where: { tenantKey } }),
            prisma.assignment.findMany({
                where: {
                    tenantKey,
                    data: { gte: lookbackStart, lte: end }
                },
                include: { shiftTemplate: true }
            }),
            prisma.unavailability.findMany({
                where: {
                    tenantKey,
                    data: { gte: lookbackStart, lte: end }
                }
            }),
            prisma.constraint.findMany({ where: { tenantKey } }),
            prisma.coverageRow.findMany({
                where: {
                    tenantKey,
                    weekStart: { gte: lookbackStart, lte: end } // Approximation. Should check if ranges overlap.
                }
            })
        ]);

        // 2. Prepare Context
        // Separate "Current" window assignments from "Previous" for context
        const currentAssignments = assignments.filter(a => a.data >= start && a.data <= end);
        const previousAssignments = assignments.filter(a => a.data < start);

        const context: EngineContext = {
            staffList,
            assignments: currentAssignments,
            previousWindowAssignments: previousAssignments,
            unavailabilities,
            coverageRows: coverageRows as any,
            config: {
                maxWeeklyHours: 40,
                minRestHours: 11,
                maxConsecutiveDays: 6,
                contractToleranceHours: 1
            }
        };

        // 3. Run Engine
        const engine = new ShiftEngine();
        const errors = engine.validate(context);

        return NextResponse.json({ errors });

    } catch (error) {
        console.error('Validation API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
