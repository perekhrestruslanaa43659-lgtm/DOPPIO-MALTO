
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const tenantKey = 'perekhrestruslanaa43659-lgtm'; // User's bucket
    const weekStart = '2026-02-02'; // a test week

    console.log(`Testing with Tenant: ${tenantKey}, Week: ${weekStart}`);

    // 1. Clean state
    await prisma.coverageRow.deleteMany({
        where: { weekStart, tenantKey }
    });

    // 2. Insert Initial Data
    await prisma.coverageRow.createMany({
        data: [
            { weekStart, tenantKey, station: 'STATION_A', frequency: '', slots: '{}', extra: '{}' },
            { weekStart, tenantKey, station: 'STATION_B', frequency: '', slots: '{}', extra: '{}' }
        ]
    });

    console.log('Initial state: 2 rows created.');

    // 3. Simulate "Save" with 1 row deleted (POST logic simulation)
    // The POST endpoint deletes ALL for that week/tenant, then inserts.

    console.log('Simulating POST /api/requirements with STATION_A only...');

    // a. Delete all
    const deleted = await prisma.coverageRow.deleteMany({
        where: { weekStart, tenantKey }
    });
    console.log(`Deleted ${deleted.count} rows (Expected 2)`);

    // b. Insert new list (only STATION_A)
    const created = await prisma.coverageRow.createMany({
        data: [
            { weekStart, tenantKey, station: 'STATION_A', frequency: '', slots: '{}', extra: '{}' }
        ]
    });
    console.log(`Created ${created.count} rows (Expected 1)`);

    // 4. Verify Final State
    const finalRows = await prisma.coverageRow.findMany({
        where: { weekStart, tenantKey }
    });

    console.log('Final Database State:');
    finalRows.forEach(r => console.log(` - ${r.station}`));

    if (finalRows.length === 1 && finalRows[0].station === 'STATION_A') {
        console.log('✅ TEST PASSED: Deletion persisted correctly.');
    } else {
        console.log('❌ TEST FAILED: Persistence incorrect.');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
