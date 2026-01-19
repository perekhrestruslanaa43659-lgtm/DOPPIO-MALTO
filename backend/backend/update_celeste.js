const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Find Celeste
    let staff = await prisma.staff.findFirst({
        where: { nome: { contains: 'CELESTE' } }
    });

    if (!staff) {
        console.log("Celeste not found, trying fuzzy...");
        staff = await prisma.staff.findFirst({
            where: { nome: { contains: 'Celeste' } }
        });
    }

    if (!staff) {
        console.log("CELESTE not found in DB.");
        return;
    }

    console.log(`Updating ${staff.nome} ${staff.cognome} (${staff.id})...`);

    let fixed = staff.fixedShifts || {};
    if (typeof fixed !== 'object') fixed = {};

    // Venerdì Sera 18:00-00:00
    // (Assuming P is free or unchanged? "fa solo" implies strictness, but I'll just set the positive ones)
    fixed['Venerdì_S'] = "18:00-00:00";

    // Sabato 12-15 e 19-00
    fixed['Sabato_P'] = "12:00-15:00";
    fixed['Sabato_S'] = "19:00-00:00";

    // Domenica 12-18 (Split at 16:00)
    fixed['Domenica_P'] = "12:00-16:00";
    fixed['Domenica_S'] = "16:00-18:00";

    await prisma.staff.update({
        where: { id: staff.id },
        data: { fixedShifts: fixed }
    });

    console.log("Updated Celeste's shifts successfully.");
}

main().finally(() => prisma.$disconnect());
