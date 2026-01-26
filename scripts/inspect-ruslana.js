
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const start = '2026-01-12';
    const end = '2026-01-18';

    console.log(`Checking assignments for Ruslana between ${start} and ${end}...`);

    const staff = await prisma.staff.findFirst({
        where: { nome: { contains: 'Ruslana', mode: 'insensitive' } }
    });

    if (!staff) {
        console.log('Ruslana not found');
        return;
    }

    const assignments = await prisma.assignment.findMany({
        where: {
            staffId: staff.id,
            data: { gte: start, lte: end }
        },
        orderBy: { data: 'asc' }
    });

    const fs = require('fs');
    let output = `Found ${assignments.length} assignments:\n`;
    assignments.forEach(a => {
        output += `${a.data}: ${a.start_time} - ${a.end_time} (${a.postazione}) [ID: ${a.id}]\n`;
    });
    console.log(output);
    fs.writeFileSync('debug_ruslana.txt', output);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
