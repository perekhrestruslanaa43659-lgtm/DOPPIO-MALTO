const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const csvPath = 'c:/scheduling/WEEK_TURNI - Foglio17.csv';
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    const dataLines = lines.slice(1);

    for (const line of dataLines) {
        // Parse CSV line
        const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!parts || parts.length < 8) continue;
        const clean = parts.map(p => p.replace(/^"|"$/g, '').trim());

        const nome = clean[0];
        const cognome = clean[1];

        const oreMin = parseInt(clean[4]) || 0;
        const oreMax = parseInt(clean[5]) || 40;
        const costo = parseFloat(clean[6].replace(',', '.')) || 0; // Handle Italian decimal comma

        // Find Staff
        let staff = await prisma.staff.findFirst({
            where: {
                nome: { equals: nome, mode: 'insensitive' },
                cognome: { equals: cognome, mode: 'insensitive' }
            }
        });

        if (staff) {
            console.log(`Updating ${nome} ${cognome}: Min=${oreMin}, Max=${oreMax}, Cost=${costo}`);
            await prisma.staff.update({
                where: { id: staff.id },
                data: {
                    oreMinime: oreMin,
                    oreMassime: oreMax,
                    costoOra: costo
                }
            });
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
