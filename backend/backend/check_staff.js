const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const allStaff = await prisma.staff.findMany();
    console.log(`Total Staff Count: ${allStaff.length}`);
    console.log("Names found:", allStaff.map(s => `${s.nome} ${s.cognome}`).join(', '));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
