const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('=== FINAL VERIFICATION TEST ===\n');

    // 1. Check connection
    try {
        await prisma.$connect();
        console.log('✅ Database connection: OK\n');
    } catch (e) {
        console.log('❌ Database connection FAILED:', e.message);
        return;
    }

    // 2. Find user
    const ruslana = await prisma.staff.findFirst({
        where: { nome: { contains: 'Ruslana', mode: 'insensitive' } }
    });

    if (!ruslana) {
        console.log('❌ No staff found. Database might be empty.');
        return;
    }

    const tenantKey = ruslana.tenantKey;
    console.log(`✅ Tenant found: ${tenantKey}`);
    console.log(`✅ Staff: ${ruslana.nome}\n`);

    // 3. Check forecast data
    const allForecasts = await prisma.forecastRow.findMany({
        where: { tenantKey },
        orderBy: { weekStart: 'desc' }
    });

    console.log(`📊 FORECAST DATA IN DATABASE:`);
    console.log(`   Total records: ${allForecasts.length}\n`);

    if (allForecasts.length > 0) {
        console.log('   Available weeks:');
        allForecasts.forEach(f => {
            console.log(`   - ${f.weekStart} (ID: ${f.id}, ${f.data.length} chars)`);
        });
    } else {
        console.log('   ⚠️  No forecast data found!');
    }

    console.log('\n✅ VERIFICATION COMPLETE');
    console.log('\nNEXT STEPS:');
    console.log('1. Open http://localhost:3000 in your browser');
    console.log('2. Login with your credentials');
    console.log('3. Go to Forecast page');
    console.log('4. You should see data for the weeks listed above');
    console.log('5. Try uploading a file');
    console.log('6. Navigate to another page (e.g., Calendar)');
    console.log('7. Come back to Forecast - data should still be there!');
}

main()
    .catch(e => console.error('ERROR:', e))
    .finally(() => prisma.$disconnect());
