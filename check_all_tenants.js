
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const start = "2026-02-02";
    const end = "2026-03-08"; // Check a wider range

    const assignments = await prisma.assignment.findMany({
        where: {
            data: {
                gte: start,
                lte: end
            }
        },
        select: { tenantKey: true }
    });

    const tenants = {};
    assignments.forEach(a => {
        tenants[a.tenantKey] = (tenants[a.tenantKey] || 0) + 1;
    });

    console.log('Assignment counts per tenant:', JSON.stringify(tenants, null, 2));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
