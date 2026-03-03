
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log('Checking for ACC GIU...');
    try {
        const count = await prisma.assignment.count({
            where: {
                postazione: 'ACC GIU'
            }
        });
        console.log(`Found ${count} assignments with ACC GIU.`);
    } catch (e) {
        console.error(e);
    }
}

check()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
