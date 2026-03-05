
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const s = await prisma.staff.update({
        where: { id: 57 },
        data: { productivityWeight: 0.5 }
    });
    console.log(`Updated Seck Codou (ID: 57) to productivityWeight: 0.5`);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
