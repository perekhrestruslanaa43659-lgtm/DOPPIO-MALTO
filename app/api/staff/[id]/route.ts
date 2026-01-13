
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');

        if (!tenantKey) {
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const id = parseInt(params.id);
        const body = await request.json();

        // Handle postazioni conversion (String -> String[])
        let postazioni: string[] = [];
        if (typeof body.postazioni === 'string') {
            postazioni = body.postazioni.split(',').map((s: string) => s.trim()).filter((s: string) => s !== '');
        } else if (Array.isArray(body.postazioni)) {
            postazioni = body.postazioni;
        }

        // We must update ONLY if tenantKey matches
        // First verify existence or just use UpdateMany? 
        // UpdateMany returns BatchPayload { count }, doesn't return the object.
        // Prisma `update` allows `where: { id, tenantKey }`? Only if there is a compound unique constraint.
        // We only have `id` as PK. 
        // So we should do `updateMany` (safe) OR `findFirst` then `update`.
        // BUT `update` requires `id` to be unique.

        // Safe approach:
        const existing = await prisma.staff.findFirst({
            where: { id, tenantKey }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
        }

        const staff = await prisma.staff.update({
            where: { id },
            data: {
                nome: body.nome,
                cognome: body.cognome,
                email: body.email || null,
                ruolo: body.ruolo,
                oreMinime: parseInt(body.oreMinime) || 0,
                oreMassime: parseInt(body.oreMassime) || 40,
                costoOra: parseFloat(body.costoOra) || 0,
                moltiplicatore: parseFloat(body.moltiplicatore) || 1.0,
                postazioni: postazioni,
            },
        });

        return NextResponse.json(staff);
    } catch (error) {
        console.error('Error updating staff:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');

        if (!tenantKey) {
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const id = parseInt(params.id);

        // Verify ownership
        const existing = await prisma.staff.findFirst({
            where: { id, tenantKey }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
        }

        await prisma.staff.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting staff:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
