
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        console.log('\n=== SCHEDULE GET REQUEST ===');
        const tenantKey = request.headers.get('x-user-tenant-key');
        console.log('📍 TenantKey:', tenantKey);

        if (!tenantKey) {
            console.log('❌ Nessun tenant key fornito');
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const start = searchParams.get('start');
        const end = searchParams.get('end');
        console.log('📅 Range date:', { start, end });

        if (!start || !end) {
            console.log('❌ Parametri start/end mancanti');
            return NextResponse.json({ error: 'Start and End dates required' }, { status: 400 });
        }

        console.log('🔍 Ricerca assignments...');
        const [assignments, requests, unavailabilities] = await prisma.$transaction([
            prisma.assignment.findMany({
                where: {
                    tenantKey,
                    data: {
                        gte: start,
                        lte: end,
                    },
                },
                include: {
                    shiftTemplate: true,
                    staff: true,
                },
            }),
            prisma.permissionRequest.findMany({
                where: {
                    status: 'APPROVED',
                    Staff: { tenantKey }, // Ensure tenant isolation via relation
                    data: {
                        gte: start,
                        lte: end,
                    },
                },
            }),
            prisma.unavailability.findMany({
                where: {
                    tenantKey,
                    data: {
                        gte: start,
                        lte: end,
                    },
                },
            })
        ]);

        console.log(`✅ Trovati ${assignments.length} assignments, ${requests.length} richieste approvate, ${unavailabilities.length} indisponibilità`);
        console.log('=== SCHEDULE GET SUCCESS ===\n');
        return NextResponse.json({ assignments, requests, unavailabilities });
    } catch (error) {
        console.error('\n❌ === SCHEDULE GET ERROR ===');
        console.error('Tipo errore:', error instanceof Error ? error.constructor.name : typeof error);
        console.error('Messaggio:', error instanceof Error ? error.message : String(error));
        console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
        console.error('=============================\n');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        console.log('\n=== SCHEDULE DELETE REQUEST ===');
        const tenantKey = request.headers.get('x-user-tenant-key');
        console.log('📍 TenantKey:', tenantKey);

        if (!tenantKey) {
            console.log('❌ Nessun tenant key fornito');
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const start = searchParams.get('start');
        const end = searchParams.get('end');
        console.log('📅 Range date da eliminare:', { start, end });

        if (!start || !end) {
            console.log('❌ Parametri start/end mancanti');
            return NextResponse.json({ error: 'Start and End dates required' }, { status: 400 });
        }

        console.log('🗑️  Eliminazione assignments in corso...');
        const deleted = await prisma.assignment.deleteMany({
            where: {
                tenantKey,
                data: {
                    gte: start,
                    lte: end,
                },
            },
        });

        console.log(`✅ Eliminati ${deleted.count} assignments`);
        console.log('=== SCHEDULE DELETE SUCCESS ===\n');
        return NextResponse.json(deleted);
    } catch (error) {
        console.error('\n❌ === SCHEDULE DELETE ERROR ===');
        console.error('Tipo errore:', error instanceof Error ? error.constructor.name : typeof error);
        console.error('Messaggio:', error instanceof Error ? error.message : String(error));
        console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
        console.error('=================================\n');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
