
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateSmartSchedule } from '@/lib/scheduler';
import { prisma } from '@/lib/prisma'; // Keep for transaction if needed, or if generateSmartSchedule handles it internally?
// generateSmartSchedule returns array of objects, we need to save them.
// Looking at scheduler.ts: "return newAssignments" (array).
// So we save here.

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');
        if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

        const body = await request.json();
        const { start, end } = body;

        if (!start || !end) {
            return NextResponse.json({ error: 'Start and End dates required' }, { status: 400 });
        }

        // 1. Clear existing assignments in the range (Overwrite)
        // This prevents doubling of hours if generated multiple times
        await prisma.assignment.deleteMany({
            where: {
                tenantKey,
                data: {
                    gte: start,
                    lte: end
                },
                // Removed status: false to ensure FULL OVERWRITE of the generated period.
                // REVERTED: We MUST preserve status: true (Manual Assignments) to avoid overwriting user WORK.
                status: false
            }
        });

        // 2. Call Smart Scheduler
        const result = await generateSmartSchedule(start, end, tenantKey);
        const { assignments, unassigned } = result;

        // Batch Create
        if (assignments.length > 0) {
            await prisma.assignment.createMany({
                data: assignments
            });
        }

        return NextResponse.json({ success: true, count: assignments.length, unassigned });

    } catch (error: any) {
        console.error('Error generating schedule:', error);
        return NextResponse.json({ error: 'Generate Error: ' + error.message }, { status: 500 });
    }
}
