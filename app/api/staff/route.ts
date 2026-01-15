
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');

        if (!tenantKey) {
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const staff = await prisma.staff.findMany({
            where: { tenantKey },
            orderBy: { listIndex: 'asc' }, // Respect custom order (e.g. import order)
        });

        // Convert ListIndex if needed (or rely on frontend to specific sort)
        // Legacy frontend expects "postazioni" to be a string?
        // Let's check: StaffPage.jsx line 291: Array.isArray(s.postazioni) ? s.postazioni.join(', ') : ...
        // So frontend handles Array safely. We can return array.

        return NextResponse.json(staff);
    } catch (error) {
        console.error('Error fetching staff:', error);
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

        // Handle postazioni conversion (String -> String[])
        let postazioni: string[] = [];
        if (typeof body.postazioni === 'string') {
            postazioni = body.postazioni.split(',').map((s: string) => s.trim()).filter((s: string) => s !== '');
        } else if (Array.isArray(body.postazioni)) {
            postazioni = body.postazioni;
        }

        const staff = await prisma.staff.create({
            data: {
                nome: body.nome,
                cognome: body.cognome || '',
                email: body.email || null,
                ruolo: body.ruolo,
                oreMinime: parseInt(body.oreMinime) || 0,
                oreMassime: parseInt(body.oreMassime) || 40,
                costoOra: parseFloat(body.costoOra) || 0,
                moltiplicatore: parseFloat(body.moltiplicatore) || 1.0,
                postazioni: postazioni,
                postazioni: postazioni,
                listIndex: 0, // Default to 0, or calculate max
                tenantKey: tenantKey,
                skillLevel: body.skillLevel || 'MEDIUM',
                incompatibilityId: body.incompatibilityId || null,
            },
        });

        return NextResponse.json(staff);
    } catch (error) {
        console.error('Error creating staff:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
