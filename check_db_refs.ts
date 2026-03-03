
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log('Checking Assignments...');
    const badAssignments = await prisma.assignment.findMany({
        where: {
            OR: [
                { start_time: { contains: '#REF' } },
                { end_time: { contains: '#REF' } }
            ]
        }
    });
    console.log(`Found ${badAssignments.length} bad assignments`);
    badAssignments.forEach(a => console.log(`ID: ${a.id}, Start: ${a.start_time}, End: ${a.end_time}, Staff: ${a.staffId}, Date: ${a.data}`));

    console.log('Checking ShiftTemplates...');
    const badTemplates = await prisma.shiftTemplate.findMany({
        where: {
            OR: [
                { oraInizio: { contains: '#REF' } },
                { oraFine: { contains: '#REF' } }
            ]
        }
    });
    console.log(`Found ${badTemplates.length} bad templates`);
    badTemplates.forEach(t => console.log(`ID: ${t.id}, Start: ${t.oraInizio}, End: ${t.oraFine}`));
}

check()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
