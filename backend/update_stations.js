const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const csvPath = 'c:/scheduling/WEEK_TURNI - Foglio17.csv';
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);

    // Skip header
    const dataLines = lines.slice(1);

    for (const line of dataLines) {
        // Simple CSV parse handling quotes
        // Matches: "value" or value
        const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!parts || parts.length < 8) continue;

        // Clean quotes
        const clean = parts.map(p => p.replace(/^"|"$/g, '').trim());

        const nome = clean[0];
        const cognome = clean[1];
        const rawPostazioni = clean[7];

        // Split by comma
        // "BARGIU, B/S, BARSU" -> ["BARGIU", "B/S", "BARSU"]
        const postazioni = rawPostazioni.split(',').map(p => p.trim());

        console.log(`Updating ${nome} ${cognome} -> [${postazioni.join(', ')}]`);

        // Update DB
        // Find by Email (parts[2]) or Name/Surname
        const email = clean[2];

        let staff = await prisma.staff.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
        if (!staff) {
            staff = await prisma.staff.findFirst({
                where: {
                    nome: { equals: nome, mode: 'insensitive' },
                    cognome: { equals: cognome, mode: 'insensitive' }
                }
            });
        }

        if (staff) {
            await prisma.staff.update({
                where: { id: staff.id },
                data: { postazioni: postazioni }
            });
        } else {
            console.warn(`  Staff not found: ${nome} ${cognome}`);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
