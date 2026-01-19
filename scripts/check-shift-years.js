
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const ruslana = await prisma.staff.findFirst({
        where: { nome: { contains: 'Ruslana', mode: 'insensitive' } }
    });

    if (!ruslana) { console.log('No Ruslana'); return; }

    const shifts = await prisma.recurringShift.findMany({
        where: { staffId: ruslana.id }
    });

    console.log(`--- Shifts for ${ruslana.nome} ---`);
    if (shifts.length === 0) console.log('No fixed shifts found.');

    shifts.forEach(s => {
        console.log(`ID: ${s.id}, Day: ${s.dayOfWeek}, Years: ${s.startYear || 'Any'} - ${s.endYear || 'Any'}`);
    });
}

main().finally(() => prisma.$disconnect());
