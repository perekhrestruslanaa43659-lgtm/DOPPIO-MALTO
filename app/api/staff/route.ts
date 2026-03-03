
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        console.log('\n=== STAFF GET REQUEST ===');
        const tenantKey = request.headers.get('x-user-tenant-key');
        console.log('📍 TenantKey:', tenantKey);

        if (!tenantKey) {
            console.log('❌ Nessun tenant key fornito');
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        console.log('🔍 Ricerca staff...');
        const staff = await prisma.staff.findMany({
            where: { tenantKey },
            orderBy: { listIndex: 'asc' }, // Respect custom order (e.g. import order)
        });

        const fs = require('fs');
        const logData = `[${new Date().toISOString()}] TenantKey: ${tenantKey}, StaffFound: ${staff.length}\n`;
        try { fs.appendFileSync('debug_staff.log', logData); } catch (e) { }

        console.log(`✅ Trovati ${staff.length} membri dello staff`);
        console.log('=== STAFF GET SUCCESS ===\n');

        // Convert postazioni from string to array for frontend compatibility
        const staffWithParsedPostazioni = staff.map(member => {
            let postazioni: string[] = [];

            try {
                if (typeof member.postazioni === 'string') {
                    // Try to parse as JSON first
                    if (member.postazioni.trim().startsWith('[')) {
                        postazioni = JSON.parse(member.postazioni);
                    } else if (member.postazioni.trim()) {
                        // Fallback: split by comma
                        postazioni = member.postazioni.split(',').map(s => s.trim()).filter(s => s);
                    }
                } else if (Array.isArray(member.postazioni)) {
                    postazioni = member.postazioni;
                }
            } catch (error) {
                console.error(`⚠️ Error parsing postazioni for staff ${member.id}:`, error);
                // Fallback to empty array
                postazioni = [];
            }

            return {
                ...member,
                postazioni
            };
        });

        return NextResponse.json(staffWithParsedPostazioni);
    } catch (error) {
        const fs = require('fs');
        try { fs.appendFileSync('debug_staff.log', `[${new Date().toISOString()}] ERROR: ${error}\n`); } catch (e) { }
        console.error('\n❌ === STAFF GET ERROR ===');
        console.error('Tipo errore:', error instanceof Error ? error.constructor.name : typeof error);
        console.error('Messaggio:', error instanceof Error ? error.message : String(error));
        console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
        console.error('==========================\n');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        console.log('\n=== STAFF POST REQUEST ===');
        const tenantKey = request.headers.get('x-user-tenant-key');
        console.log('📍 TenantKey:', tenantKey);

        if (!tenantKey) {
            console.log('❌ Nessun tenant key fornito');
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const body = await request.json();
        console.log('👤 Creazione nuovo staff:', body.nome, body.cognome);

        // Handle postazioni conversion (String -> String[])
        let postazioni: string[] = [];
        if (typeof body.postazioni === 'string') {
            postazioni = body.postazioni.split(',').map((s: string) => s.trim()).filter((s: string) => s !== '');
        } else if (Array.isArray(body.postazioni)) {
            postazioni = body.postazioni;
        }
        console.log('   - Ruolo:', body.ruolo);
        console.log('   - Postazioni:', postazioni);

        const staff = await prisma.staff.create({
            data: {
                nome: body.nome,
                cognome: body.cognome || '',
                email: body.email || null,
                ruolo: body.ruolo,
                oreMinime: parseInt(body.oreMinime) || 0,
                oreMassime: !isNaN(parseInt(body.oreMassime)) ? parseInt(body.oreMassime) : 40,
                costoOra: parseFloat(body.costoOra) || 0,
                moltiplicatore: parseFloat(body.moltiplicatore) || 1.0,
                postazioni: JSON.stringify(postazioni),

                listIndex: 0, // Default to 0, or calculate max
                tenantKey: tenantKey,
                skillLevel: body.skillLevel || 'MEDIUM',
                contractType: body.contractType || 'STANDARD',
                incompatibilityId: body.incompatibilityId || null,
            },
        });

        console.log(`✅ Staff creato con ID: ${staff.id}`);
        console.log('=== STAFF POST SUCCESS ===\n');
        return NextResponse.json(staff);
    } catch (error) {
        console.error('\n❌ === STAFF POST ERROR ===');
        console.error('Tipo errore:', error instanceof Error ? error.constructor.name : typeof error);
        console.error('Messaggio:', error instanceof Error ? error.message : String(error));
        console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
        console.error('===========================\n');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const tenantKey = request.headers.get('x-user-tenant-key');

        if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        if (!id) return NextResponse.json({ error: 'Staff ID required' }, { status: 400 });

        const body = await request.json();
        const data: any = {};

        // Helper to check if a key exists in body (even if null/empty)
        const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);

        if (has('nome')) data.nome = body.nome;
        if (has('cognome')) data.cognome = body.cognome || '';
        if (has('email')) data.email = body.email || null;
        if (has('ruolo')) data.ruolo = body.ruolo;

        if (has('oreMinime')) data.oreMinime = parseInt(body.oreMinime) || 0;
        if (has('oreMassime')) data.oreMassime = !isNaN(parseInt(body.oreMassime)) ? parseInt(body.oreMassime) : 40;

        if (has('costoOra')) data.costoOra = parseFloat(body.costoOra) || 0;
        if (has('moltiplicatore')) data.moltiplicatore = parseFloat(body.moltiplicatore) || 1.0;

        if (has('skillLevel')) data.skillLevel = body.skillLevel || 'MEDIUM';
        if (has('contractType')) data.contractType = body.contractType || 'STANDARD';
        if (has('incompatibilityId')) data.incompatibilityId = body.incompatibilityId || null;
        if (has('listIndex')) data.listIndex = body.listIndex;

        // Handle Postazioni
        if (has('postazioni')) {
            let postazioni: string[] = [];
            if (typeof body.postazioni === 'string') {
                postazioni = body.postazioni.split(',').map((s: string) => s.trim()).filter((s: string) => s !== '');
            } else if (Array.isArray(body.postazioni)) {
                postazioni = body.postazioni;
            }
            data.postazioni = JSON.stringify(postazioni);
        }

        const staff = await prisma.staff.update({
            where: { id: parseInt(id), tenantKey }, // Ensure tenant safety
            data: data,
        });

        return NextResponse.json(staff);
    } catch (error) {
        console.error('Error updating staff:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const tenantKey = request.headers.get('x-user-tenant-key');

        if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        if (!id) return NextResponse.json({ error: 'Staff ID required' }, { status: 400 });

        const body = await request.json();
        const data: any = {};

        // Handle Postazioni
        if (body.postazioni !== undefined) {
            let postazioni: string[] = [];
            if (typeof body.postazioni === 'string') {
                postazioni = body.postazioni.split(',').map((s: string) => s.trim()).filter((s: string) => s !== '');
            } else if (Array.isArray(body.postazioni)) {
                postazioni = body.postazioni;
            }
            data.postazioni = JSON.stringify(postazioni);
        }

        const staff = await prisma.staff.update({
            where: { id: parseInt(id), tenantKey },
            data: data,
        });

        return NextResponse.json(staff);
    } catch (error) {
        console.error('Error patching staff:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const all = searchParams.get('all');
        const tenantKey = request.headers.get('x-user-tenant-key');

        if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

        if (all === 'true') {
            await prisma.staff.deleteMany({
                where: { tenantKey }
            });
            return NextResponse.json({ success: true, count: 'all' });
        }

        if (!id) return NextResponse.json({ error: 'Staff ID required' }, { status: 400 });

        await prisma.staff.delete({
            where: { id: parseInt(id), tenantKey }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting staff:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-user-tenant-key',
        },
    });
}
