import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BUILTIN_RULES, SchedulingRuleRecord } from '@/lib/schedulingRules';

export const dynamic = 'force-dynamic';

// ─── Seed built-in rules for a tenant if they don't exist yet ─────────────────
async function seedBuiltins(tenantKey: string) {
    for (const rule of BUILTIN_RULES) {
        await (prisma as any).schedulingRule.upsert({
            where: { tenantKey_code: { tenantKey, code: rule.code } },
            update: {}, // don't overwrite user changes
            create: { tenantKey, ...rule },
        });
    }
}

// ─── GET /api/scheduling-rules ────────────────────────────────────────────────
export async function GET(request: NextRequest) {
    const tenantKey = request.headers.get('x-user-tenant-key');
    if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

    // Seed defaults on first access
    await seedBuiltins(tenantKey);

    const rules = await (prisma as any).schedulingRule.findMany({
        where: { tenantKey },
        orderBy: [{ isBuiltin: 'desc' }, { code: 'asc' }],
    });

    return NextResponse.json(rules);
}

// ─── POST /api/scheduling-rules ───────────────────────────────────────────────
// Create a new custom rule
export async function POST(request: NextRequest) {
    const tenantKey = request.headers.get('x-user-tenant-key');
    if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

    const body = await request.json();
    const { code, name, description, params } = body;

    if (!code || !name) {
        return NextResponse.json({ error: 'code e name sono obbligatori' }, { status: 400 });
    }

    // Validate params is valid JSON
    try { JSON.parse(params || '{}'); } catch {
        return NextResponse.json({ error: 'params deve essere JSON valido' }, { status: 400 });
    }

    const rule = await (prisma as any).schedulingRule.create({
        data: {
            tenantKey,
            code: code.toUpperCase().replace(/\s+/g, '_'),
            name,
            description: description || '',
            params: params || '{}',
            enabled: true,
            isBuiltin: false,
        },
    });

    return NextResponse.json(rule, { status: 201 });
}

// ─── PATCH /api/scheduling-rules ──────────────────────────────────────────────
// Toggle enabled or update params
export async function PATCH(request: NextRequest) {
    const tenantKey = request.headers.get('x-user-tenant-key');
    if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

    const body = await request.json();
    const { id, enabled, params, name, description } = body;

    if (!id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 });

    const existing = await (prisma as any).schedulingRule.findFirst({
        where: { id: Number(id), tenantKey },
    });
    if (!existing) return NextResponse.json({ error: 'Regola non trovata' }, { status: 404 });

    const updateData: any = {};
    if (typeof enabled === 'boolean') updateData.enabled = enabled;
    if (typeof params === 'string') {
        try { JSON.parse(params); } catch {
            return NextResponse.json({ error: 'params deve essere JSON valido' }, { status: 400 });
        }
        updateData.params = params;
    }
    if (typeof name === 'string' && !existing.isBuiltin) updateData.name = name;
    if (typeof description === 'string') updateData.description = description;

    const updated = await (prisma as any).schedulingRule.update({
        where: { id: Number(id) },
        data: updateData,
    });

    return NextResponse.json(updated);
}

// ─── DELETE /api/scheduling-rules ─────────────────────────────────────────────
// Only custom rules can be deleted; built-ins can only be disabled
export async function DELETE(request: NextRequest) {
    const tenantKey = request.headers.get('x-user-tenant-key');
    if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 });

    const rule = await (prisma as any).schedulingRule.findFirst({
        where: { id: Number(id), tenantKey },
    });
    if (!rule) return NextResponse.json({ error: 'Regola non trovata' }, { status: 404 });
    if (rule.isBuiltin) {
        return NextResponse.json({ error: 'Le regole predefinite non possono essere eliminate. Puoi solo disabilitarle.' }, { status: 403 });
    }

    await (prisma as any).schedulingRule.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true });
}
