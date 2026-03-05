
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const ids = [41, 40, 63, 75, 43, 44]; // Managers
    const recurring = await prisma.recurringShift.findMany({
        where: { staffId: { in: ids } },
        include: { staff: true }
    });

    console.log('Manager recurring shifts details:');
    recurring.forEach(r => {
        console.log(`${r.staff.nome} (ID ${r.staffId}): Day ${r.dayOfWeek}, ${r.start_time}-${r.end_time}, W${r.startWeek}-${r.endWeek} Y${r.startYear}-${r.endYear}`);
    });
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
