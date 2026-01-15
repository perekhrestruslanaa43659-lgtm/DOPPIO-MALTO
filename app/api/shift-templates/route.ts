
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

        const templates = await prisma.shiftTemplate.findMany({
            where: { tenantKey },
            orderBy: { id: 'asc' }, // Or whatever order
        });

        return NextResponse.json(templates);
    } catch (error) {
        console.error('Error fetching shift templates:', error);
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

        // Handle giorniValidi which is String in DB but maybe array in payload?
        // Legacy seems to use it as Array or String? 
        // Prisma schema: giorniValidi String @default("")
        // If body.giorniValidi is array, join it?
        let giorniValidi = "";
        if (Array.isArray(body.giorniValidi)) {
            giorniValidi = JSON.stringify(body.giorniValidi);
        } else {
            giorniValidi = String(body.giorniValidi || "");
        }

        const tmpl = await prisma.shiftTemplate.create({
            data: {
                nome: body.nome,
                oraInizio: body.oraInizio,
                oraFine: body.oraFine,
                ruoloRichiesto: body.ruoloRichiesto,
                giorniValidi: giorniValidi,
                tenantKey: tenantKey,
            },
        });

        return NextResponse.json(tmpl);
    } catch (error) {
        console.error('Error creating shift template:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
