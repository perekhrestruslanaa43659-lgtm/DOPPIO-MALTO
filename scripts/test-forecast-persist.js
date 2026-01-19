
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Testing Forecast Persistence ---');

    // 1. Get Ruslana to find a valid tenant
    const ruslana = await prisma.staff.findFirst({
        where: { nome: { contains: 'Ruslana', mode: 'insensitive' } }
    });

    if (!ruslana) { console.log('Ruslana not found'); return; }
    const tenantKey = ruslana.tenantKey;
    console.log(`Using Tenant: ${tenantKey}`);

    const weekStart = '2026-05-04'; // Future week
    const testData = JSON.stringify([['Row1', '100', '200']]);

    // 2. Simulate Wipe & Replace
    // Manually doing what the API does
    console.log(`Deleting existing for ${weekStart}...`);
    await prisma.forecastRow.deleteMany({
        where: { weekStart, tenantKey }
    });

    console.log('Creating new row...');
    try {
        const created = await prisma.forecastRow.create({
            data: {
                weekStart,
                data: testData,
                tenantKey
            }
        });
        console.log(`Created ID: ${created.id}`);
    } catch (e) {
        console.error('Error creating:', e);
    }

    // 3. Verify Read
    console.log('Reading back...');
    const found = await prisma.forecastRow.findMany({
        where: { weekStart, tenantKey },
        orderBy: { id: 'desc' }
    });

    if (found.length > 0) {
        if (found[0].data === testData) {
            console.log('SUCCESS: Data persisted and matched.');
        } else {
            console.log('FAILURE: Data Mismatch.');
            console.log('Sent:', testData);
            console.log('Read:', found[0].data);
        }
    } else {
        console.log('FAILURE: Data not found.');
    }
}

main().finally(() => prisma.$disconnect());
