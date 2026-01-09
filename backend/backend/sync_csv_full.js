const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const csvPath = path.join(__dirname, '../WEEK_TURNI - view_staff (1).csv');
    console.log(`Reading CSV from: ${csvPath}`);

    if (!fs.existsSync(csvPath)) {
        console.error("File not found!");
        process.exit(1);
    }

    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);

    // Skip header? Check first line
    const startIdx = lines[0].toLowerCase().startsWith('nome') ? 1 : 0;

    console.log(`Found ${lines.length - startIdx} rows.`);

    let upserted = 0;
    let skipped = 0;

    for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i];
        // CSV parsing (simple split by comma, careful with quotes if any)
        // The previous output showed standard CSV. 
        // Example: RUMEL,HANNAN,,,40,40,7
        const cols = line.split(',');

        // Mapping:
        // 0: Nome
        // 1: Cognome
        // 2: Email
        // 3: Ruolo
        // 4: OreMin
        // 5: OreMax
        // 6: Costo
        // 7: Postazioni (might be quoted if comma inside? User showed "Lavaggio, Preparazione" in previous logs?)
        // Let's handle generic split carefully? 
        // Actually, usually user CSVs here are simple. If "Lavaggio, Preparazione" was in one cell, it likely was visually separated but in CSV it triggers split.
        // Wait, the previous `type` output: `Lavaggio, Preparazione"` was visible?
        // Let's look at the partial output again.

        // If I use a library it's safer, but I don't want to install one.
        // Let's assume simple CSV or handle basic quotes.

        // For now, let's try simple split and join remaining for postazioni if needed?
        // Structure seems: Nome,Cognome,Email,Ruolo,OreMin,OreMax,Costo,Postazioni
        // If cols > 8, maybe postazioni has commas.

        const nome = cols[0] ? cols[0].trim() : '';
        const cognome = cols[1] ? cols[1].trim() : '';

        if (!nome) {
            skipped++;
            continue;
        }

        const email = cols[2] ? cols[2].trim() : null;
        const ruolo = cols[3] && cols[3].trim() ? cols[3].trim() : 'Staff';
        const oreMin = parseInt(cols[4]) || 0;
        const oreMax = parseInt(cols[5]) || 40;
        const costo = parseFloat(cols[6]) || 0;

        // Postazioni: Join the rest?
        // If cols length > 8, cols[7]...cols[N] are postazioni parts
        let postazioniRaw = cols.slice(7).join(',');
        // Remove quotes
        postazioniRaw = postazioniRaw.replace(/^"|"$/g, '').trim();

        // Valid array?
        const postazioni = postazioniRaw
            ? postazioniRaw.split(',').map(p => p.trim()).filter(p => p)
            : [];

        try {
            // Upsert by Email if present, otherwise potentially Name+Surname
            // Prisma schema has Email unique? YES. 
            // But some staff might not have email.
            // Let's try to match by Name + Cognome if no email or email is empty.

            let existing = null;
            if (email) {
                existing = await prisma.staff.findUnique({ where: { email } });
            }
            if (!existing) {
                // Find by Nome+Cognome
                existing = await prisma.staff.findFirst({
                    where: {
                        nome: { equals: nome, mode: 'insensitive' },
                        cognome: { equals: cognome, mode: 'insensitive' }
                    }
                });
            }

            const data = {
                nome,
                cognome,
                email: email || undefined, // If null/empty string, undef so prisma doesn't try to set "" if unique
                ruolo,
                oreMinime: oreMin,
                oreMassime: oreMax,
                costoOra: costo,
                postazioni: postazioni, // Array
                listIndex: i
            };

            if (existing) {
                await prisma.staff.update({
                    where: { id: existing.id },
                    data
                });
                // console.log(`Updated ${nome} ${cognome}`);
            } else {
                await prisma.staff.create({
                    data
                });
                console.log(`Created ${nome} ${cognome}`);
            }
            upserted++;

        } catch (e) {
            console.error(`Error processing ${nome} ${cognome}:`, e.message);
        }
    }

    console.log(`Done. Upserted: ${upserted}, Skipped: ${skipped}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
