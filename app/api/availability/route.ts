
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staffId');
    const tenantKey = request.headers.get('x-user-tenant-key');

    if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

    try {
        const where: any = { tenantKey };
        if (staffId) where.staffId = parseInt(staffId);

        const availability = await prisma.availability.findMany({
            where,
            include: { staff: true }
        });
        return NextResponse.json(availability);
    } catch (error) {
        return NextResponse.json({ error: 'Error fetching availability' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const tenantKey = request.headers.get('x-user-tenant-key');
    if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

    try {
        const body = await request.json();
        const { staffId, dayOfWeek, date, startTime, endTime } = body;

        const newAvail = await prisma.availability.create({
            data: {
                staffId,
                dayOfWeek, // Optional
                date,      // Optional
                startTime,
                endTime,
                tenantKey
            }
        });
        return NextResponse.json(newAvail);
    } catch (error) {
        return NextResponse.json({ error: 'Error saving availability' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const tenantKey = request.headers.get('x-user-tenant-key');

    if (!id || !tenantKey) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    try {
        await prisma.availability.delete({
            where: { id: parseInt(id), tenantKey }
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Error deleting availability' }, { status: 500 });
    }
}
