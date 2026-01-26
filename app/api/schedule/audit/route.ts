
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auditSchedule } from '@/lib/scheduler';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const tenantKey = request.headers.get('x-user-tenant-key');

    if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

    if (!start || !end) {
        return NextResponse.json({ error: 'Start and End dates required' }, { status: 400 });
    }

    try {
        const missing = await auditSchedule(start, end, tenantKey);
        return NextResponse.json(missing);
    } catch (e: any) {
        console.error('Audit Error:', e);
        return NextResponse.json({ error: 'Audit Error: ' + e.message }, { status: 500 });
    }
}
