
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log('--- START ---');

    // Check for ACCGIU
    const bad = await prisma.assignment.count({ where: { postazione: { contains: 'ACCGIU' } } });
    console.log(`Assignments with ACCGIU (bad): ${bad}`);

    // Check for ACC GIU
    const good = await prisma.assignment.count({ where: { postazione: 'ACC GIU' } });
    console.log(`Assignments with ACC GIU (good): ${good}`);

    if (bad > 0) {
        console.log('Fixing...');
        // Fetch valid IDs first to be safe
        const badItems = await prisma.assignment.findMany({
            where: { postazione: { contains: 'ACCGIU' } },
            select: { id: true, postazione: true }
        });

        for (const item of badItems) {
            console.log(`Updating ID ${item.id}: ${item.postazione} -> ACC GIU`);
            await prisma.assignment.update({
                where: { id: item.id },
                data: { postazione: 'ACC GIU' }
            });
        }
        console.log('Update complete.');
    } else {
        console.log('No bad assignments found.');
    }

    console.log('--- END ---');
}

run()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
