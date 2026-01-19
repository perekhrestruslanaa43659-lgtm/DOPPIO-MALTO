const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('=== FULL FORECAST CYCLE TEST ===\n');

    // 1. Setup
    const ruslana = await prisma.staff.findFirst({
        where: { nome: { contains: 'Ruslana', mode: 'insensitive' } }
    });

    if (!ruslana) {
        console.log('❌ Ruslana not found');
        return;
    }

    const tenantKey = ruslana.tenantKey;
    const weekStart = '2026-01-12'; // Week 3
    console.log(`✅ Tenant: ${tenantKey}`);
    console.log(`✅ Testing week: ${weekStart}\n`);

    // 2. SIMULATE SAVE (what happens when you upload a file)
    console.log('📤 STEP 1: SIMULATING FILE UPLOAD & SAVE...');
    const testData = JSON.stringify([
        ['Dettaglio', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'],
        ['Budget pranzo', '1000', '1000', '1000', '1000', '1000', '1000', '1000'],
        ['Real pranzo', '0', '0', '0', '0', '0', '0', '0']
    ]);

    // Delete existing (like the API does)
    console.log('   Deleting old data...');
    const deleted = await prisma.forecastRow.deleteMany({
        where: { weekStart, tenantKey }
    });
    console.log(`   Deleted ${deleted.count} old records`);

    // Create new
    console.log('   Creating new record...');
    const created = await prisma.forecastRow.create({
        data: {
            weekStart,
            data: testData,
            tenantKey
        }
    });
    console.log(`   ✅ Created record ID: ${created.id}\n`);

    // 3. SIMULATE PAGE RELOAD (what happens when you come back)
    console.log('🔄 STEP 2: SIMULATING PAGE RELOAD...');
    console.log(`   Searching for: weekStart = "${weekStart}" AND tenantKey = "${tenantKey}"`);

    // This is what the API does now (after my fix)
    const found = await prisma.forecastRow.findMany({
        where: {
            weekStart: weekStart,  // Exact match
            tenantKey: tenantKey
        },
        orderBy: [
            { weekStart: 'desc' },
            { id: 'desc' }
        ]
    });

    console.log(`   Found ${found.length} records`);

    if (found.length > 0) {
        console.log(`   ✅ SUCCESS! Data found:`);
        found.forEach(row => {
            console.log(`      ID: ${row.id}`);
            console.log(`      Week: ${row.weekStart}`);
            console.log(`      Data length: ${row.data.length} chars`);
            console.log(`      Preview: ${row.data.substring(0, 100)}...`);
        });
    } else {
        console.log(`   ❌ FAILURE! No data found`);
        console.log('\n   Checking what IS in the database:');
        const all = await prisma.forecastRow.findMany({
            where: { tenantKey },
            orderBy: { weekStart: 'desc' }
        });
        all.forEach(row => {
            console.log(`      - Week: ${row.weekStart} (ID: ${row.id})`);
        });
    }

    // 4. VERIFY WITH DIFFERENT QUERY STYLES
    console.log('\n🔍 STEP 3: TESTING DIFFERENT QUERY STYLES...');

    // Old style (with gte - this was the bug)
    const oldStyle = await prisma.forecastRow.findMany({
        where: {
            weekStart: { gte: weekStart },
            tenantKey
        }
    });
    console.log(`   Old style (gte): Found ${oldStyle.length} records`);

    // Range style (start === end)
    const rangeStyle = await prisma.forecastRow.findMany({
        where: {
            weekStart: {
                gte: weekStart,
                lte: weekStart
            },
            tenantKey
        }
    });
    console.log(`   Range style (gte+lte): Found ${rangeStyle.length} records`);

    // Exact match (new style)
    const exactMatch = await prisma.forecastRow.findMany({
        where: {
            weekStart: weekStart,
            tenantKey
        }
    });
    console.log(`   Exact match: Found ${exactMatch.length} records`);

    console.log('\n✅ TEST COMPLETE');
}

main()
    .catch(e => console.error('ERROR:', e))
    .finally(() => prisma.$disconnect());
