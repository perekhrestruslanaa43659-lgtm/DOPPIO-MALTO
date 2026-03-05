
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const managers = ["LUCA", "GIULIA", "PAOLO", "RUSLANA", "JUAN"];
    const staff = await prisma.staff.findMany({
        where: {
            nome: { in: managers, mode: 'insensitive' },
            tenantKey: "locale-test-doppio-malto"
        },
        select: { id: true, nome: true }
    });

    const ids = staff.map(s => s.id);
    const recurring = await prisma.recurringShift.findMany({
        where: { staffId: { in: ids } }
    });

    console.log('Manager recurring shifts:', JSON.stringify(recurring.map(r => ({
        staffId: r.staffId,
        day: r.dayOfWeek,
        start: r.start_time,
        end: r.end_time,
        startWeek: r.startWeek,
        endWeek: r.endWeek,
        startYear: r.startYear,
        endYear: r.endYear
    })), null, 2));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
