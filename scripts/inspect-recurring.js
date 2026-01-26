
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log(`Checking recurring shifts for Ruslana...`);

    const staff = await prisma.staff.findFirst({
        where: { nome: { contains: 'Ruslana', mode: 'insensitive' } }
    });

    if (!staff) {
        console.log('Ruslana not found');
        return;
    }

    const recurring = await prisma.recurringShift.findMany({
        where: { staffId: staff.id }
    });

    const fs = require('fs');
    let output = `Found ${recurring.length} recurring shifts:\n`;
    recurring.forEach(r => {
        output += `Day ${r.dayOfWeek}: ${r.start_time} - ${r.end_time} (${r.postazione})\n`;
    });
    console.log(output);
    fs.writeFileSync('debug_recurring.txt', output);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
