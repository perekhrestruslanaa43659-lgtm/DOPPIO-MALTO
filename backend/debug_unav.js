const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Checking Unavailability...");
    const u = await prisma.unavailability.findMany();
    console.log(`Found ${u.length} items.`);
    if (u.length > 0) console.log(u[0]);

    console.log("Checking Unavailability with Staff...");
    const us = await prisma.unavailability.findMany({
        take: 1,
        include: { staff: true }
    });
    console.log("Success:", us);
}

main()
    .catch(e => console.error("CRASH:", e))
    .finally(() => prisma.$disconnect());
