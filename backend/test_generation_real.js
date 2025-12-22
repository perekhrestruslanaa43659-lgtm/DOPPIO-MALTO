const { PrismaClient } = require('@prisma/client');
const { generateSchedule } = require('./scheduler');
const prisma = new PrismaClient();

async function main() {
    console.log("TESTING GENERATION for Week Nov 17-23, 2025");

    const startDate = new Date('2025-11-17T00:00:00Z');
    const endDate = new Date('2025-11-23T23:59:59Z');

    // 1. Fetch Data
    const allStaff = await prisma.staff.findMany({ include: { unavailabilities: true } });
    const coverageRows = await prisma.coverageRow.findMany();

    console.log(`Context: ${allStaff.length} Staff, ${coverageRows.length} Coverage Rows`);

    // 2. Generate
    const { assignments } = generateSchedule(startDate, endDate, allStaff, coverageRows);

    console.log(`\nRESULT: Generated ${assignments.length} assignments.`);

    if (assignments.length > 0) {
        console.log("Sample Assignments:");
        assignments.slice(0, 5).forEach(a => {
            console.log(` - ${a.date} | Staff ${a.staffId} | ${a.postazione} | ${a.customStart}-${a.customEnd}`);
        });
    } else {
        console.log("Still 0 assignments. Check logs for skip reasons.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
