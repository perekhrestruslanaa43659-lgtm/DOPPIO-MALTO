
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

        console.log(`Fixing keys for: ${seck.nome} ${seck.cognome}`);

        // Correct Keys
        const fixedShifts = {
            "Lunedì_P": "10:30-15:30",
            "Martedì_P": "10:30-15:30",
            "Mercoledì_P": "10:30-15:30",
            "Giovedì_P": "10:30-15:30",
            "Venerdì_P": "10:30-15:30"
        };

        // Also ensure "NO" for others if strict? 
        // User just said "Assign...". I will stick to the Positive constraint.
        // Scheduler will use these P keys to VALIDATE and PRIORITY assignment.

        const updated = await prisma.staff.update({
            where: { id: seck.id },
            data: {
                fixedShifts: JSON.stringify(fixedShifts)
            }
        });

        console.log("Updated Fixed Shifts (Corrected):", updated.fixedShifts);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
