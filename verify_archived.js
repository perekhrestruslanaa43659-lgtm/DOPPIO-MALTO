
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const staff = await prisma.staff.findFirst();
    if (staff && 'archived' in staff) {
        console.log('✅ Property "archived" exists in Staff model');
    } else if (!staff) {
        console.log('No staff found to check');
    } else {
        console.log('❌ Property "archived" does NOT exist in Staff model');
    }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
