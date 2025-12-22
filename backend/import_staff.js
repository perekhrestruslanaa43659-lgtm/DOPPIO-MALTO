const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Use the specific file mentioned by the user
    const filePath = '../WEEK_TURNI - Foglio17.csv';

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n');

    console.log(`Reading ${lines.length} lines from ${filePath}...`);

    // Skip header (line 1), start from index 1.
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse CSV: Nome,Cognome,Email,Ruolo,OreMin,OreMax,Costo,Postazioni
        // Simple split by comma, ignoring quotes for now as the sample didn't have complex quotes in the first few meaningful columns.
        // Ideally use a CSV parser, but for this specific file structure:

        // Logic to handle basic quoted strings if present (Postazioni often has quotes)
        const row = [];
        let current = '';
        let inQuote = false;
        for (const char of line) {
            if (char === '"') { inQuote = !inQuote; continue; }
            if (char === ',' && !inQuote) { row.push(current); current = ''; }
            else current += char;
        }
        row.push(current);

        if (row.length < 6) {
            console.log(`Skipping invalid line: ${line}`);
            continue;
        }

        const nome = row[0].trim();
        const cognome = row[1].trim();
        const email = row[2].trim();
        const ruolo = row[3].trim();
        const oreMax = parseInt(row[5].trim());

        if (!nome || nome.toUpperCase() === 'NOME') continue;

        console.log(`Importing: ${nome} ${cognome} (${email}) - Max: ${oreMax}`);

        await prisma.staff.upsert({
            where: { email: email.toLowerCase() },
            update: {
                nome: nome,
                cognome: cognome,
                ruolo: ruolo,
                oreMassime: isNaN(oreMax) ? 40 : oreMax
            },
            create: {
                nome: nome,
                cognome: cognome,
                email: email.toLowerCase(),
                ruolo: ruolo,
                oreMassime: isNaN(oreMax) ? 40 : oreMax
            }
        });
    }
    console.log("Import completed.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
