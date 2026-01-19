const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Checking Database State...");

    // Check connection
    try {
        const staffCount = await prisma.staff.count();
        console.log(`Staff Count: ${staffCount}`);

        const assignmentCount = await prisma.assignment.count();
        console.log(`Assignment Count: ${assignmentCount}`);

        if (assignmentCount > 0) {
            const last = await prisma.assignment.findMany({
                take: 5,
                orderBy: { id: 'desc' },
                include: { staff: true }
            });
            console.log("\nMost recent 5 Assignments:");
            last.forEach(a => {
                console.log(`- [${a.status}] ${a.staff.nome} on ${a.data}: ${a.start_time}-${a.end_time} (ID: ${a.id})`);
            });
        } else {
            console.log("\nNo assignments found.");
        }

    } catch (e) {
        console.error("Error connecting/querying:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
