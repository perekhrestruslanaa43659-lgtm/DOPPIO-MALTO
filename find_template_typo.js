
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log('Searching ShiftTemplates for ACCGIU...');
    const templates = await prisma.shiftTemplate.findMany({
        where: {
            nome: { contains: 'ACCGIU' }
        }
    });
    console.log(`Found ${templates.length} templates with ACCGIU`);
    if (templates.length > 0) {
        console.log('Sample:', templates[0]);
    }
}

check()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
