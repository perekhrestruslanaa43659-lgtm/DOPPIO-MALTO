
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const userEmail = request.headers.get('x-user-email');
        const tenantKey = request.headers.get('x-user-tenant-key');

        if (!userEmail || !tenantKey) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        if (!Array.isArray(body)) {
            return NextResponse.json({ error: 'Expected array of staff' }, { status: 400 });
        }

        let count = 0;

        // Check if we are appending (i.e. if there is existing staff)
        const lastStaff = await prisma.staff.findFirst({
            where: { tenantKey },
            orderBy: { listIndex: 'desc' }
        });

        if (lastStaff) {
            count = lastStaff.listIndex + 1;
        }

        for (const item of body) {
            try {
                // Determine name/surname combo for uniqueness check or just add them
                // Assuming imports are new or we want to add them. 
                // Let's clean headers before insert
                await prisma.staff.create({
                    data: {
                        nome: item.nome,
                        cognome: item.cognome || '',
                        ruolo: item.ruolo || 'Staff',
                        email: item.email || null,
                        oreMinime: item.oreMinime || 0,
                        oreMassime: item.oreMassime || 40,
                        costoOra: item.costoOra || 0,
                        postazioni: item.postazioni || [],
                        listIndex: item.listIndex !== undefined ? item.listIndex : count, // Use client index if provided
                        tenantKey: tenantKey
                    }
                });
                count++;
            } catch (e) {
                // Ignore duplicates or errors for individual rows to keep going?
                // Or maybe they want to see errors. For bulk import often best effort is preferred.
                console.error("Import row validation failed or duplicate", e);
            }
        }

        return NextResponse.json({ message: `Imported ${count} staff members` });

    } catch (error) {
        console.error('Bulk import error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');
        if (!tenantKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        await prisma.staff.deleteMany({
            where: { tenantKey }
        });

        return NextResponse.json({ message: 'All staff deleted' });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 });
    }
}
