
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
    console.log('Fixing ACCGIU typo in Assignments (JS)...');
    try {
        const result = await prisma.assignment.updateMany({
            where: {
                postazione: { contains: 'ACCGIU' }
            },
            data: {
                postazione: 'ACC GIU'
            }
        });
        console.log(`Updated ${result.count} assignments.`);
    } catch (e) {
        console.error("Error updating:", e);
    }
}

fix()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
