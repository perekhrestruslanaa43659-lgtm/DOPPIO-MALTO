
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MANAGERS = [
    'LUCA GNECCO',
    'GIULIA BONZI',
    'PAOLO PALINI',
    'RUSLANA PEREKHREST',
    'JUAN GAETANI'
];

const KITCHEN = [
    'ABIR', 'IMRAN', 'SHOHEL', 'JUBAIR', 'SAHIDUL', 'SHOAG', 'BABUL', 'ADIL', 'JAHIDUR', 'SUAB', 'RUMEL'
]; // Match partial names/surnames

async function main() {
    console.log("🚀 Organizing Staff Roles...");

    const staff = await prisma.staff.findMany();

    for (const s of staff) {
        const fullName = `${s.nome} ${s.cognome}`.toUpperCase();
        let newRole = 'SALA'; // Default

        // Check Manager
        if (MANAGERS.some(m => fullName.includes(m))) {
            newRole = 'MANAGER';
        }
        // Check Kitchen
        else if (KITCHEN.some(k => fullName.includes(k))) {
            newRole = 'CUCINA';
        }
        // Special casing for Supporto Navigli?
        else if (fullName.includes('SUPPORTO') || fullName.includes('NAVIGLI')) {
            newRole = 'SALA'; // Or 'ALTRO'? User put it under Sala implicitly or Altro?
            // In the text paste: "SUPPORTO NAVIGLI" was under "SALA" (technically under ALTRO in the paste but grouped with staff).
            // Actually in paste:
            // MANAGER ...
            // SALA ...
            // ALTRO ... (contains Luca Gnecco?? Wait)

            // Let's re-read the paste structure from step 322.
            // MANAGER: Giulia, Paolo, Ruslana, Juan.
            // SALA: Moussa, Ermanno, Elena, Ahmed, Elias, David, Meran, Matteo...
            // CUCINA: Abir, Imran...

            // Wait, "ALTRO" section in paste had: Luca Gnecco, Giulia, Paolo...
            // But user said: "la prima sezione manager luca giulia paolo ruslana juan"
            // So we force Luca into Manager.

            // "ALTRO" also had: Mamadou Diallo, Karina, Luca Cordonatto, Nettra, Antonio, Daniel, Supporto.
            // These usually go to Sala or maybe "LAVAGGIO"? 
            // User said: "poi sala: moussa ..... cucina abir , imran,...."
            // Implicitly, the rest are Sala?
            // "cucina abir, imran..." matches the list I extracted.
        }

        if (s.ruolo !== newRole) {
            console.log(`Updating ${s.nome} ${s.cognome}: ${s.ruolo} -> ${newRole}`);
            await prisma.staff.update({
                where: { id: s.id },
                data: { ruolo: newRole }
            });
        }
    }
    console.log("✅ Roles updated.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
