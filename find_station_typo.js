
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log('Searching Assignments for ACCGIU...');
    const assignments = await prisma.assignment.findMany({
        where: {
            postazione: { contains: 'ACCGIU' }
        }
    });
    console.log(`Found ${assignments.length} assignments with ACCGIU`);
    if (assignments.length > 0) {
        console.log('Sample:', assignments[0]);
    }

    console.log('Searching Requirements (if table exists)...');
    // Assuming Requirements might be stored as json or a table. 
    // Based on previous context, Requirements seem to be fetched via API, maybe stored in a table?
    // Let's check if there is a 'Requirement' model or similar.
    // I'll check the schema first if I could, but I'll guess 'RequirementRow' or just skip for now.
}

check()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
