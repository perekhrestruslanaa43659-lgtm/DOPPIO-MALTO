
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const staff = await prisma.staff.findMany();
        const seck = staff.find(s => s.nome.toLowerCase().includes('seck') || (s.cognome && s.cognome.toLowerCase().includes('seck')));

        if (!seck) {
            console.log("Seck Codou not found!");
            return;
        }

        console.log(`Found: ${seck.nome} ${seck.cognome} (ID: ${seck.id})`);

        // Prepare Fixed Shifts
        // User request: Lun-Ven, 10:30-15:30
        const shifts = {};
        const days = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven'];
        days.forEach(d => {
            shifts[`${d}_P`] = "10:30-15:30";
        });

        // Preserve existing if any? Or overwrite? User request sounds like a SET command.
        // We will overwrite to ensure it's clean, but maybe merge if needed. 
        // For now, simple overwrite of these keys.
        let current = {};
        if (seck.fixedShifts) {
            try {
                current = JSON.parse(seck.fixedShifts);
            } catch (e) { current = {}; }
        }

        // Merge
        const newShifts = { ...current, ...shifts };

        const updated = await prisma.staff.update({
            where: { id: seck.id },
            data: {
                fixedShifts: JSON.stringify(newShifts)
            }
        });

        console.log("Updated Fixed Shifts:", updated.fixedShifts);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
