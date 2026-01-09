const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const filePath = '../WEEK_TURNI - Foglio17.csv';
    console.log(`Syncing staff from ${filePath}...`);

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n');

    // 1. Reset all listIndex to 999
    await prisma.staff.updateMany({ data: { listIndex: 999 } });

    let orderCounter = 1;
    const processedIds = new Set();

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse CSV line
        const row = [];
        let current = '';
        let inQuote = false;
        for (const char of line) {
            if (char === '"') { inQuote = !inQuote; continue; }
            if (char === ',' && !inQuote) { row.push(current); current = ''; }
            else current += char;
        }
        row.push(current);

        if (row.length < 5) continue;

        const nome = row[0].trim();
        const cognome = row[1].trim();
        const email = row[2].trim();
        const ruolo = row[3].trim();
        const oreMax = parseInt(row[5].trim()) || 40;

        if (!nome || nome.toUpperCase() === 'NOME') continue;

        // Search for existing staff by Email matches OR Name+Cognome matches
        // We fetch ALL that match to handle duplicates
        const candidates = await prisma.staff.findMany({
            where: {
                OR: [
                    { email: { equals: email, mode: 'insensitive' } },
                    {
                        AND: [
                            { nome: { equals: nome, mode: 'insensitive' } },
                            { cognome: { equals: cognome, mode: 'insensitive' } }
                        ]
                    }
                ]
            }
        });

        let primaryStaff = null;

        if (candidates.length > 0) {
            // Pick the best candidate (e.g. one with Assignments, or just the first one)
            // Let's sort by ID to keep the oldest (stable)
            const sorted = candidates.sort((a, b) => a.id - b.id);
            primaryStaff = sorted[0];

            // MERGE DUPLICATES
            for (let j = 1; j < sorted.length; j++) {
                const dupe = sorted[j];
                console.log(`Merging duplicate ${dupe.nome} ${dupe.cognome} (ID: ${dupe.id}) into ID: ${primaryStaff.id}`);

                // Move assignments
                await prisma.assignment.updateMany({
                    where: { staffId: dupe.id },
                    data: { staffId: primaryStaff.id }
                });
                // Delete dupe
                await prisma.staff.delete({ where: { id: dupe.id } });
            }

            // Update Primary
            await prisma.staff.update({
                where: { id: primaryStaff.id },
                data: {
                    nome, cognome, email: email.toLowerCase(), ruolo, oreMassime: oreMax,
                    listIndex: orderCounter
                }
            });

        } else {
            // Create new
            console.log(`Creating new staff: ${nome} ${cognome}`);
            primaryStaff = await prisma.staff.create({
                data: {
                    nome, cognome, email: email.toLowerCase(), ruolo, oreMassime: oreMax,
                    listIndex: orderCounter
                }
            });
        }

        processedIds.add(primaryStaff.id);
        orderCounter++;
    }

    // 2. Delete Staff that were NOT in the CSV (listIndex is still 999)
    // But be careful not to delete processed ones (redundant check but safe)
    const toDelete = await prisma.staff.findMany({
        where: { listIndex: 999 }
    });

    console.log(`Found ${toDelete.length} staff not in CSV. Deleting...`);
    for (const s of toDelete) {
        console.log(`Deleting extraneous: ${s.nome} ${s.cognome}`);
        await prisma.staff.delete({ where: { id: s.id } });
    }

    console.log("Sync Complete.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
