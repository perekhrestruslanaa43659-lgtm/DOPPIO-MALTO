
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const coverage = await prisma.coverageRow.findMany({
        where: { tenantKey: "locale-test-doppio-malto" },
        select: { id: true, weekStart: true }
    });

    console.log('All coverage weeks for tenant:', JSON.stringify(coverage, null, 2));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
