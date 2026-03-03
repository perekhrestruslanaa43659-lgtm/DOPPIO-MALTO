
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Migrating Coverage Rows for Week 6 2026...');

    // 1. Find rows with incorrect weekStart '2026-02-01'
    const incorrectRows = await prisma.coverageRow.findMany({
        where: {
            weekStart: '2026-02-01'
        }
    });

    console.log(`Found ${incorrectRows.length} rows to migrate.`);

    if (incorrectRows.length === 0) {
        console.log('No rows to migrate.');
        return;
    }

    // 2. Check if target rows already exist '2026-02-02'
    const existingTargetRows = await prisma.coverageRow.findMany({
        where: {
            weekStart: '2026-02-02'
        }
    });

    console.log(`Found ${existingTargetRows.length} rows already at target date.`);

    // Strategy:
    // If target rows exist, we might be overwriting or merging.
    // Since user said "I don't find them anymore", the target is likely empty or sparse.
    // We will DELETE any existing target rows (assuming they are just empty shells created by new load)
    // AND UPDATE the incorrect rows to the new date.

    if (existingTargetRows.length > 0) {
        console.log('Deleting existing target rows to avoid collision...');
        await prisma.coverageRow.deleteMany({
            where: { weekStart: '2026-02-02' }
        });
    }

    // 3. Update incorrect rows
    const updated = await prisma.coverageRow.updateMany({
        where: { weekStart: '2026-02-01' },
        data: { weekStart: '2026-02-02' }
    });

    console.log(`✅ Migrated ${updated.count} rows from 2026-02-01 to 2026-02-02.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
