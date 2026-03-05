
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const ids = [41, 40, 63, 75, 43, 44]; // Managers
    const start = "2026-02-02";
    const end = "2026-02-08";

    const assignments = await prisma.assignment.findMany({
        where: {
            staffId: { in: ids },
            data: { gte: start, lte: end }
        },
        include: { staff: true }
    });

    console.log('Manager assignments found in DB:');
    assignments.forEach(a => {
        console.log(`${a.staff.nome}: ${a.data} ${a.start_time}-${a.end_time} (${a.postazione})`);
    });
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
