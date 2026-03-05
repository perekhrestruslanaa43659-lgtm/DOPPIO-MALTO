
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const staffId = 75; // Juan
    const staff = await prisma.staff.findUnique({
        where: { id: staffId }
    });
    const recurring = await prisma.recurringShift.findMany({
        where: { staffId }
    });

    console.log('Juan details:', JSON.stringify(staff, null, 2));
    console.log('Juan recurring shifts:', JSON.stringify(recurring, null, 2));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
