
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const tenantKey = "locale-test-doppio-malto";
    const weeks = ["2026-02-02", "2026-02-09"];

    for (const weekStart of weeks) {
        const coverage = await prisma.coverageRow.findMany({
            where: { tenantKey, weekStart }
        });
        console.log(`Coverage for week ${weekStart}: ${coverage.length} rows`);
        if (coverage.length > 0) {
            let totalReq = 0;
            coverage.forEach(row => {
                try {
                    const data = JSON.parse(row.data || '{}');
                    Object.values(data).forEach((day) => {
                        const d = day;
                        totalReq += (d.P1 || 0) + (d.P2 || 0) + (d.S1 || 0) + (d.S2 || 0);
                    });
                } catch (e) { }
            });
            console.log(`Total slots required: ${totalReq}`);
        }
    }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
