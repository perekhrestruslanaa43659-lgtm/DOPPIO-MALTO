
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');

        console.log('\n=== FORECAST GET REQUEST ===');
        console.log('TenantKey:', tenantKey);

        if (!tenantKey) {
            console.log('❌ No tenant key!');
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const start = searchParams.get('start');
        const end = searchParams.get('end');

        console.log('Query params:', { start, end });

        const whereClause: any = { tenantKey };
        if (start && end) {
            // If start === end, search for exact match
            if (start === end) {
                whereClause.weekStart = start;
                console.log('Using EXACT match for weekStart:', start);
            } else {
                // Range query
                whereClause.weekStart = {
                    gte: start,
                    lte: end
                };
                console.log('Using RANGE query:', { gte: start, lte: end });
            }
        } else if (start) {
            // Single date - exact match
            whereClause.weekStart = start;
            console.log('Using SINGLE date match:', start);
        }

        console.log('Final where clause:', JSON.stringify(whereClause));

        const forecast = await prisma.forecastRow.findMany({
            where: whereClause,
            orderBy: [
                { weekStart: 'desc' },
                { id: 'desc' }  // In case of duplicates, get the latest created
            ],
        });

        console.log(`✅ Found ${forecast.length} records`);
        if (forecast.length > 0) {
            forecast.forEach(f => {
                console.log(`   - ID: ${f.id}, Week: ${f.weekStart}, Data length: ${f.data.length}`);
            });
        }
        console.log('=========================\n');

        // Add no-cache headers to prevent browser caching
        return NextResponse.json(forecast, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
    } catch (error) {
        console.error('Error fetching forecast:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        console.log('\n=== FORECAST POST REQUEST ===');
        const tenantKey = request.headers.get('x-user-tenant-key');
        console.log('📍 TenantKey:', tenantKey);

        if (!tenantKey) {
            console.log('❌ Nessun tenant key fornito');
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const body = await request.json();
        console.log('📦 Body ricevuto (tipo):', Array.isArray(body) ? 'Array' : 'Object');

        // Handle both Array input (from Frontend) and Object input { rows: [] }
        const rows = Array.isArray(body) ? body : (body.rows || []);
        console.log('📊 Numero di righe da salvare:', rows.length);

        // Simple approach: create new rows. 
        // Logic for updates depends on frontend sending IDs or not.
        // If IDs are present, update. Else create.

        const results = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            console.log(`\n  📝 Processando riga ${i + 1}/${rows.length}:`);
            console.log(`     - weekStart: ${row.weekStart}`);
            console.log(`     - data length: ${typeof row.data === 'string' ? row.data.length : JSON.stringify(row.data).length} caratteri`);

            // 1. Wipe & Replace Strategy
            // To prevent "Zombie Data" or duplicates causing issues, we DELETE all rows for this week first.
            if (row.weekStart) {
                console.log(`     🗑️  Eliminazione dati esistenti per week ${row.weekStart}...`);
                const deleteResult = await prisma.forecastRow.deleteMany({
                    where: {
                        weekStart: row.weekStart,
                        tenantKey
                    }
                });
                console.log(`     ✅ Eliminati ${deleteResult.count} record esistenti`);
            }

            // 2. Create fresh
            console.log(`     ➕ Creazione nuovo record...`);
            const item = await prisma.forecastRow.create({
                data: {
                    weekStart: row.weekStart,
                    data: typeof row.data === 'string' ? row.data : JSON.stringify(row.data),
                    tenantKey,
                }
            });
            console.log(`     ✅ Record creato con ID: ${item.id}`);

            results.push(item);
        }

        console.log(`\n✅ Salvati ${results.length} record forecast totali`);
        console.log('=== FORECAST POST SUCCESS ===\n');
        return NextResponse.json({ rows: results });
    } catch (error) {
        console.error('\n❌ === FORECAST POST ERROR ===');
        console.error('Tipo errore:', error instanceof Error ? error.constructor.name : typeof error);
        console.error('Messaggio:', error instanceof Error ? error.message : String(error));
        console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
        console.error('==============================\n');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        console.log('\n=== FORECAST DELETE REQUEST ===');
        const tenantKey = request.headers.get('x-user-tenant-key');
        console.log('📍 TenantKey:', tenantKey);

        if (!tenantKey) {
            console.log('❌ Nessun tenant key fornito');
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const start = searchParams.get('start');
        console.log('📅 Week start da eliminare:', start);

        if (!start) {
            console.log('❌ Parametro start mancante');
            return NextResponse.json({ error: 'Start date required' }, { status: 400 });
        }

        console.log('🗑️  Eliminazione in corso...');
        const res = await prisma.forecastRow.deleteMany({
            where: {
                tenantKey,
                weekStart: start
            }
        });

        console.log(`✅ Eliminati ${res.count} record`);
        console.log('=== FORECAST DELETE SUCCESS ===\n');
        return NextResponse.json({ success: true, count: res.count });
    } catch (error) {
        console.error('\n❌ === FORECAST DELETE ERROR ===');
        console.error('Tipo errore:', error instanceof Error ? error.constructor.name : typeof error);
        console.error('Messaggio:', error instanceof Error ? error.message : String(error));
        console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
        console.error('================================\n');
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
