const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    let staff = await prisma.staff.findFirst({
        where: { OR: [{ nome: 'ERMANNO' }, { id: 52 }] }
    });

    if (!staff) return console.log("Not found");

    console.log(`Updating ${staff.nome}...`);

    let fixed = staff.fixedShifts || {};
    if (typeof fixed !== 'object') fixed = {};

    const days = ['Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

    // Split 13:00-19:00 at 16:00
    days.forEach(day => {
        fixed[`${day}_P`] = "13:00-16:00"; // Lunch
        fixed[`${day}_S`] = "16:00-19:00"; // Dinner (starts immediately after lunch)
    });

    await prisma.staff.update({
        where: { id: staff.id },
        data: { fixedShifts: fixed }
    });
    console.log("Updated with split 13-16 / 16-19");
}

main().finally(() => prisma.$disconnect());
