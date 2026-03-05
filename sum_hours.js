
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

function toMinutes(time) {
    if (!time) return 0;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

async function main() {
    const tenantKey = "locale-test-doppio-malto";
    const start = "2026-02-02";
    const end = "2026-02-08";

    const assignments = await prisma.assignment.findMany({
        where: {
            tenantKey,
            data: { gte: start, lte: end }
        }
    });

    let totalMinutes = 0;
    assignments.forEach(a => {
        const s = toMinutes(a.start_time);
        const e = toMinutes(a.end_time);
        let diff = e - s;
        if (diff < 0) diff += 1440;
        totalMinutes += diff;
    });

    console.log(`Tenant: ${tenantKey}`);
    console.log(`Range: ${start} - ${end}`);
    console.log(`Assignments: ${assignments.length}`);
    console.log(`Total Hours: ${totalMinutes / 60}`);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
