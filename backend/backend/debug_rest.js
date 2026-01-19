const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Checking ShiftTemplates...");
    const t = await prisma.shiftTemplate.findMany();
    console.log(`Found ${t.length} templates.`);
    if (t.length > 0) console.log("Sample:", t[0]);

    console.log("Checking Budget...");
    const b = await prisma.budget.findMany();
    console.log(`Found ${b.length} budget items.`);
    if (b.length > 0) console.log("Sample:", b[0]);
}

main()
    .catch(e => console.error("CRASH:", e))
    .finally(() => prisma.$disconnect());
