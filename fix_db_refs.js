
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
    console.log('Deleting bad assignments...');
    const result = await prisma.assignment.deleteMany({
        where: {
            OR: [
                { start_time: { contains: '#REF' } },
                { end_time: { contains: '#REF' } }
            ]
        }
    });
    console.log(`Deleted ${result.count} bad assignments.`);
}

fix()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
