
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { analyzeWeek, DEFAULT_CAPACITY } from '@/lib/pitEngine';

export const dynamic = 'force-dynamic';

/**
 * GET /api/schedule/pit-analysis?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Returns a full PIT (Punteggio Intensità Turno) analysis for the given week:
 *  - Per-slot PIT scores with senior coverage ratios and violations
 *  - Per-staff workload analysis (hours used vs MAX, weekend count, PIT contribution)
 */
export async function GET(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');
        if (!tenantKey) {
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const start = searchParams.get('start');
        const end = searchParams.get('end');
        const capacityParam = searchParams.get('capacity');
        const capacity = capacityParam ? Math.max(1, parseInt(capacityParam, 10)) : DEFAULT_CAPACITY;

        if (!start || !end) {
            return NextResponse.json({ error: 'start and end date params required' }, { status: 400 });
        }

        // ── Fetch all data in parallel ──────────────────────────────────────
        const [staffList, assignments, budgets] = await Promise.all([
            prisma.staff.findMany({
                where: { tenantKey },
                select: {
                    id: true,
                    nome: true,
                    cognome: true,
                    ruolo: true,
                    skillLevel: true,
                    oreMassime: true,
                }
            }),
            prisma.assignment.findMany({
                where: {
                    tenantKey,
                    data: { gte: start, lte: end }
                },
                select: {
                    staffId: true,
                    data: true,
                    start_time: true,
                    end_time: true,
                }
            }),
            prisma.budget.findMany({
                where: {
                    tenantKey,
                    data: { gte: start, lte: end }
                },
                select: {
                    data: true,
                    budgetCoversLunch: true,
                    budgetCoversDinner: true,
                }
            }),
        ]);

        // ── Build date list (inclusive range) ──────────────────────────────
        const dates: string[] = [];
        const cur = new Date(start);
        const endD = new Date(end);
        while (cur <= endD) {
            dates.push(cur.toISOString().split('T')[0]);
            cur.setDate(cur.getDate() + 1);
        }

        // ── Run analysis ───────────────────────────────────────────────────
        const analysis = analyzeWeek(dates, staffList, assignments, budgets, capacity);

        return NextResponse.json({
            ...analysis,
            capacityDefault: capacity,
            weekStart: start,
            weekEnd: end,
        });

    } catch (error: any) {
        console.error('PIT Analysis error:', error);
        return NextResponse.json({ error: 'PIT Analysis error: ' + error.message }, { status: 500 });
    }
}
