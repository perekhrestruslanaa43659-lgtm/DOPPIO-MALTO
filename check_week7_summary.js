
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const tenantKey = "locale-test-doppio-malto";
    const start = "2026-02-09";
    const end = "2026-02-15";

    const assignments = await prisma.assignment.findMany({
        where: {
            tenantKey,
            data: {
                gte: start,
                lte: end
            }
        },
        include: {
            staff: { select: { nome: true } }
        }
    });

    const staffCounts = {};
    assignments.forEach(a => {
        const name = a.staff.nome;
        staffCounts[name] = (staffCounts[name] || 0) + 1;
    });

    console.log(`Summary of 98 assignments in Week 7:`, staffCounts);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
