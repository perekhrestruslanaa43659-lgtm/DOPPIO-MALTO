const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('=== FORECAST PERSISTENCE TEST ===\n');

    // 1. Find Ruslana's tenant
    const ruslana = await prisma.staff.findFirst({
        where: { nome: { contains: 'Ruslana', mode: 'insensitive' } }
    });

    if (!ruslana) {
        console.log('❌ Ruslana not found');
        return;
    }

    const tenantKey = ruslana.tenantKey;
    console.log(`✅ Using Tenant: ${tenantKey}\n`);

    // 2. List ALL forecast rows for this tenant
    console.log('📋 ALL FORECAST ROWS IN DATABASE:');
    const allRows = await prisma.forecastRow.findMany({
        where: { tenantKey },
        orderBy: { weekStart: 'asc' }
    });

    if (allRows.length === 0) {
        console.log('⚠️  NO FORECAST DATA FOUND IN DATABASE!\n');
    } else {
        allRows.forEach(row => {
            const dataPreview = row.data.substring(0, 100);
            console.log(`  Week: ${row.weekStart} | ID: ${row.id} | Data: ${dataPreview}...`);
        });
        console.log(`\n✅ Total: ${allRows.length} forecast records\n`);
    }

    // 3. Test specific week (Week 3, 2026)
    const testWeek = '2026-01-12'; // Monday of Week 3
    console.log(`🔍 Searching for specific week: ${testWeek}`);

    const specificWeek = await prisma.forecastRow.findMany({
        where: {
            weekStart: testWeek,
            tenantKey
        }
    });

    if (specificWeek.length > 0) {
        console.log(`✅ FOUND data for ${testWeek}:`);
        specificWeek.forEach(row => {
            console.log(`   ID: ${row.id}`);
            console.log(`   Data length: ${row.data.length} chars`);
            console.log(`   Preview: ${row.data.substring(0, 200)}...`);
        });
    } else {
        console.log(`❌ NO DATA for ${testWeek}`);
        console.log('\n💡 Try these weeks instead:');
        allRows.slice(0, 5).forEach(row => {
            console.log(`   - ${row.weekStart}`);
        });
    }
}

main()
    .catch(e => console.error('ERROR:', e))
    .finally(() => prisma.$disconnect());
