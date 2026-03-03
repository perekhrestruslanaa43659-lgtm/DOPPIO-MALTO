
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Inspecting Coverage Rows...');
    // Fetch all coverage rows for early 2026
    const rows = await prisma.coverageRow.findMany({
        where: {
            weekStart: {
                gte: '2026-01-20',
                lte: '2026-02-20'
            }
        }
    });

    console.log(`Found ${rows.length} rows.`);
    const grouped = {};
    rows.forEach(r => {
        if (!grouped[r.weekStart]) grouped[r.weekStart] = 0;
        grouped[r.weekStart]++;
    });

    console.log('Counts by weekStart:', grouped);

    if (rows.length > 0) {
        console.log('Sample Row:', rows[0]);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
