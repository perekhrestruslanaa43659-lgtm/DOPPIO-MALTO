
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        console.log('\n=== ASSIGNMENT POST REQUEST ===');
        const tenantKey = request.headers.get('x-user-tenant-key');
        console.log('📍 TenantKey:', tenantKey);

        if (!tenantKey) {
            console.log('❌ Nessun tenant key fornito');
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const body = await request.json();
        console.log('📋 Creazione assignment:');
        console.log('   - Data:', body.data);
        console.log('   - StaffID:', body.staffId);
        console.log('   - Orario:', body.start_time, '-', body.end_time);
        console.log('   - Postazione:', body.postazione);

        const assignment = await prisma.assignment.create({
            data: {
                data: body.data,
                staffId: parseInt(body.staffId),
                shiftTemplateId: body.shiftTemplateId ? parseInt(body.shiftTemplateId) : null,
                start_time: body.start_time,
                end_time: body.end_time,
                status: body.status || false,
                postazione: body.postazione,
                tenantKey: tenantKey,
            },
        });

        console.log(`✅ Assignment creato con ID: ${assignment.id}`);
        console.log('=== ASSIGNMENT POST SUCCESS ===\n');
        return NextResponse.json(assignment);
    } catch (error) {
        console.error('\n❌ === ASSIGNMENT POST ERROR ===');
        console.error('Tipo errore:', error instanceof Error ? error.constructor.name : typeof error);
        console.error('Messaggio:', error instanceof Error ? error.message : String(error));
        console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
        console.error('================================\n');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
