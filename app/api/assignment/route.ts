
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
                note: body.note,
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

export async function PUT(request: NextRequest) {
    try {
        console.log('\n=== ASSIGNMENT PUT REQUEST ===');
        const tenantKey = request.headers.get('x-user-tenant-key');
        console.log('📍 TenantKey:', tenantKey);

        if (!tenantKey) {
            console.log('❌ Nessun tenant key fornito');
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            console.log('❌ Nessun ID fornito');
            return NextResponse.json({ error: 'Assignment ID required' }, { status: 400 });
        }

        const body = await request.json();
        console.log('📝 Aggiornamento assignment ID:', id);
        console.log('   - Nuovi dati:', body);

        // Validate assignment belongs to tenant
        const existing = await prisma.assignment.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existing || existing.tenantKey !== tenantKey) {
            console.log('❌ Assignment non trovato o non autorizzato');
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        const assignment = await prisma.assignment.update({
            where: { id: parseInt(id) },
            data: {
                shiftTemplateId: body.shiftTemplateId !== undefined ? (body.shiftTemplateId ? parseInt(body.shiftTemplateId) : null) : undefined,
                start_time: body.start_time,
                end_time: body.end_time,
                status: body.status !== undefined ? body.status : undefined,
                postazione: body.postazione !== undefined ? body.postazione : undefined,
                note: body.note !== undefined ? body.note : undefined,
                // Allow moving assignment (DnD)
                data: body.data !== undefined ? body.data : undefined,
                staffId: body.staffId !== undefined ? parseInt(body.staffId) : undefined,
            },
        });

        console.log(`✅ Assignment ${id} aggiornato`);
        console.log('=== ASSIGNMENT PUT SUCCESS ===\n');
        return NextResponse.json(assignment);
    } catch (error) {
        console.error('\n❌ === ASSIGNMENT PUT ERROR ===');
        console.error('Tipo errore:', error instanceof Error ? error.constructor.name : typeof error);
        console.error('Messaggio:', error instanceof Error ? error.message : String(error));
        console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
        console.error('================================\n');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        console.log('\n=== ASSIGNMENT DELETE REQUEST ===');
        const tenantKey = request.headers.get('x-user-tenant-key');
        console.log('📍 TenantKey:', tenantKey);

        if (!tenantKey) {
            console.log('❌ Nessun tenant key fornito');
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            console.log('❌ Nessun ID fornito');
            return NextResponse.json({ error: 'Assignment ID required' }, { status: 400 });
        }

        console.log('🗑️  Eliminazione assignment ID:', id);

        // Validate assignment belongs to tenant
        const existing = await prisma.assignment.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existing || existing.tenantKey !== tenantKey) {
            console.log('❌ Assignment non trovato o non autorizzato');
            return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
        }

        await prisma.assignment.delete({
            where: { id: parseInt(id) }
        });

        console.log(`✅ Assignment ${id} eliminato`);
        console.log('=== ASSIGNMENT DELETE SUCCESS ===\n');
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('\n❌ === ASSIGNMENT DELETE ERROR ===');
        console.error('Tipo errore:', error instanceof Error ? error.constructor.name : typeof error);
        console.error('Messaggio:', error instanceof Error ? error.message : String(error));
        console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
        console.error('================================\n');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
