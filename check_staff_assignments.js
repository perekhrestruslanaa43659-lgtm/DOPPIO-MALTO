
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const staffId = 41; // Luca
    const start = "2026-02-02";
    const end = "2026-02-08";

    const assignments = await prisma.assignment.findMany({
        where: {
            staffId,
            data: {
                gte: start,
                lte: end
            }
        }
    });

    console.log(`Found ${assignments.length} assignments for staff ID ${staffId} between ${start} and ${end}`);
    if (assignments.length > 0) {
        console.log(JSON.stringify(assignments, null, 2));
    }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
