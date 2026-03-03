
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ─── Score → Level Mapping ────────────────────────────────────────────────────
// 1 = Non abilitato  2 = In formazione  3 = Junior OPS  4 = Senior OPS  5 = Senior OPS (Esperto)

export function scoreToLevel(score: number): {
    label: string;
    short: string;
    color: string;
    bg: string;
    border: string;
} {
    if (score <= 1) return { label: 'Non abilitato', short: '✗', color: 'text-gray-500', bg: 'bg-gray-100', border: 'border-gray-300' };
    if (score === 2) return { label: 'In formazione', short: '📚', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300' };
    if (score === 3) return { label: 'Junior', short: '🔵', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-300' };
    if (score === 4) return { label: 'Senior', short: '🟢', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300' };
    return { label: 'Senior ★', short: '⭐', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-300' };
}

// ─── GET /api/staff/competencies?staffId=X ───────────────────────────────────
export async function GET(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');
        if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

        const { searchParams } = new URL(request.url);
        const staffId = searchParams.get('staffId');

        if (staffId) {
            const competencies = await prisma.staffCompetency.findMany({
                where: { staffId: Number(staffId), tenantKey },
                orderBy: { postazione: 'asc' },
            });
            return NextResponse.json(competencies);
        }

        // Return all competencies for the tenant (keyed by staffId)
        const all = await prisma.staffCompetency.findMany({
            where: { tenantKey },
            orderBy: [{ staffId: 'asc' }, { postazione: 'asc' }],
        });
        return NextResponse.json(all);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// ─── POST /api/staff/competencies ── upsert ───────────────────────────────────
const UpsertSchema = z.object({
    staffId: z.number().int().positive(),
    postazione: z.string().min(1),
    score: z.number().int().min(1).max(5),
    note: z.string().optional().default(''),
});

export async function POST(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');
        if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

        const body = await request.json();
        const parsed = UpsertSchema.parse(body);

        const result = await prisma.staffCompetency.upsert({
            where: {
                staffId_postazione: {
                    staffId: parsed.staffId,
                    postazione: parsed.postazione,
                },
            },
            update: {
                score: parsed.score,
                note: parsed.note ?? '',
            },
            create: {
                staffId: parsed.staffId,
                postazione: parsed.postazione,
                score: parsed.score,
                note: parsed.note ?? '',
                tenantKey,
            },
        });

        return NextResponse.json(result);
    } catch (e: any) {
        if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues }, { status: 400 });
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// ─── DELETE /api/staff/competencies?id=X ─────────────────────────────────────
export async function DELETE(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');
        if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

        await prisma.staffCompetency.delete({
            where: { id: Number(id) },
        });

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
