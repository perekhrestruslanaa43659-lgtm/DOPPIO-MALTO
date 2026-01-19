const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- STAFF ROLES ---");
    const staff = await prisma.staff.groupBy({
        by: ['ruolo'],
        _count: { ruolo: true }
    });
    console.log(staff);

    console.log("\n--- SHIFT TEMPLATE REQUIRED ROLES ---");
    const templates = await prisma.shiftTemplate.groupBy({
        by: ['ruoloRichiesto'],
        _count: { ruoloRichiesto: true }
    });
    console.log(templates);

    console.log("\n--- SAMPLE CUCINA STAFF ---");
    const cucina = await prisma.staff.findFirst({ where: { ruolo: { contains: 'CUCINA', mode: 'insensitive' } } });
    console.log(cucina);

    console.log("\n--- SAMPLE MANAGER STAFF ---");
    const manager = await prisma.staff.findFirst({ where: { ruolo: { contains: 'MANAGER', mode: 'insensitive' } } });
    console.log(manager);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
