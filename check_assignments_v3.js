
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
        }
    });

    console.log(`Found ${assignments.length} assignments for ${tenantKey} between ${start} and ${end}`);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
