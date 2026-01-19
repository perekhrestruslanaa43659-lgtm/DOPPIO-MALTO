const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('=== FORECAST DATA INSPECTION ===');

    // 1. Count all records
    const count = await prisma.forecastRow.count();
    console.log(`Total ForecastRow records: ${count}`);

    // 2. Dump all records (limit 10)
    const records = await prisma.forecastRow.findMany({
        take: 10,
        orderBy: { updatedAt: 'desc' }
    });

    if (records.length === 0) {
        console.log('❌ DATABASE IS EMPTY! Save operation is failing completely.');
    } else {
        console.log('✅ Found latest records:');
        records.forEach(r => {
            console.log(`\nID: ${r.id}`);
            console.log(`Tenant: ${r.tenantKey}`);
            console.log(`Week: ${r.weekStart}`);
            console.log(`Updated: ${r.updatedAt}`);
            console.log(`Data Length: ${r.data.length} chars`);
        });
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
