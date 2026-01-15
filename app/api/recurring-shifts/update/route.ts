
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');
        if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

        const body = await request.json();
        const { id, ...data } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID required' }, { status: 400 });
        }

        const existing = await prisma.recurringShift.findFirst({
            where: { id: parseInt(id), tenantKey }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Recurring shift not found' }, { status: 404 });
        }

        const updated = await prisma.recurringShift.update({
            where: { id: parseInt(id) },
            data: {
                start_time: data.start_time,
                end_time: data.end_time,
                postazione: data.postazione,
                dayOfWeek: data.dayOfWeek ? parseInt(data.dayOfWeek) : existing.dayOfWeek,
                startWeek: data.startWeek !== undefined ? (data.startWeek ? parseInt(data.startWeek) : null) : existing.startWeek,
                endWeek: data.endWeek !== undefined ? (data.endWeek ? parseInt(data.endWeek) : null) : existing.endWeek,
                startYear: data.startYear !== undefined ? (data.startYear ? parseInt(data.startYear) : null) : existing.startYear,
                endYear: data.endYear !== undefined ? (data.endYear ? parseInt(data.endYear) : null) : existing.endYear,
            }
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating recurring shift:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
