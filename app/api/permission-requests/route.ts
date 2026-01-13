
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');

        if (!tenantKey) {
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');

        const where: any = {
            Staff: {
                tenantKey: tenantKey
            }
        };

        if (status) {
            where.status = status;
        }

        const requests = await (prisma as any).permissionRequest.findMany({
            where,
            include: {
                Staff: true, // Include staff details
                User: { select: { name: true, surname: true } } // Include processor details
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(requests);
    } catch (error) {
        console.error('Error fetching permission requests:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');

        if (!tenantKey) {
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const body = await request.json();

        // Verify staff belongs to tenant
        const staff = await prisma.staff.findFirst({
            where: { id: parseInt(body.staffId), tenantKey }
        });

        if (!staff) {
            return NextResponse.json({ error: 'Staff not found or access denied' }, { status: 403 });
        }

        const req = await (prisma as any).permissionRequest.create({
            data: {
                staffId: parseInt(body.staffId),
                data: body.data,
                tipo: body.tipo,
                motivo: body.motivo,
                dettagli: body.dettagli,
                status: 'PENDING',
                updatedAt: new Date(),
            },
        });

        return NextResponse.json(req);
    } catch (error) {
        console.error('Error creating permission request:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
