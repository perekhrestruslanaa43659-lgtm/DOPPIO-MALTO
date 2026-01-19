const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const filePath = path.join(__dirname, 'staff_raw.txt');
    console.log(`Reading List from: ${filePath}`);

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);

    // Headers: Nome, Cognome, Email, Ruolo, OreMin, OreMax, Costo, Postazioni
    // Assuming Tab Separated because typical copy-paste from Excel is TSV.
    // If not TSV, we might need regex for multiple spaces, but let's try TSV first as the user pasted aligned text.

    let upserted = 0;

    for (let i = 1; i < lines.length; i++) { // Skip Header
        const line = lines[i];

        // Try splitting by Tab first
        let cols = line.split('\t');

        // If strict tab split didn't give enough cols, maybe it's not tabs?
        // Check line "LUCA GNECCO..." usually 8 columns.
        // If cols < 2, try regex?
        if (cols.length < 2) {
            console.log(`Line ${i} has <2 cols with tabs. Trying whitespace.`);
            // This is risky if names have spaces, but let's try.
            // Actually, "BANCE MOUSSA" has spaces. "L. 68/99" has spaces.
            // If user pasted from Excel, it SHOULD be tabs.
            // Let's assume tabs.
        }

        // Mapping based on Header:
        // 0: Nome
        // 1: Cognome
        // 2: Email
        // 3: Ruolo
        // 4: OreMin
        // 5: OreMax
        // 6: Costo
        // 7: Postazioni

        const nome = cols[0] ? cols[0].trim() : '';
        const cognome = cols[1] ? cols[1].trim() : '';

        if (!nome) continue; // Skip empty lines

        let email = cols[2] ? cols[2].trim() : '';
        let ruolo = cols[3] ? cols[3].trim() : '';

        // Fallback for Kitchen Staff who might have empty Email/Role
        if (!email) {
            // Generate a fake unique email to satisfy Unique constraint if needed? 
            // Or leave undefined if Schema allows (Schema: email String? @unique). 
            // If it's optional, undefined is fine. BUT @unique implies if value exists it must be unique. 
            // Nulls are allowed in Postgres unique columns (multiple nulls ok).
            email = null;
        }

        if (!ruolo) {
            // Infer role?? Kitchen staff usually "CUCINA" or "LAVAGGIO"?
            // Or if postazioni contains "Pizza", "Burger" -> "CUCINA".
            // Let's check Postazioni.
            ruolo = 'CUCINA'; // Default for bottom list which are Kitchen
        }

        const oreMin = parseInt(cols[4]) || 0;
        const oreMax = parseInt(cols[5]) || 40;

        // Costo might be missing or empty?
        // "ADIL AHMED... 40 40 ... Pizza" -> Cost col 6 is empty string?
        // If empty, default to 0? Or keep existing?
        let costo = parseFloat(cols[6]);
        if (isNaN(costo)) costo = 0;

        let postazioniRaw = cols[7] || '';

        // Clean up Postazioni
        // "BARGIU. CDR" -> "BARGIU, CDR"
        // "Dolci/Ins; Lavaggio" -> "Dolci/Ins, Lavaggio"
        postazioniRaw = postazioniRaw.replace(/\./g, ',').replace(/;/g, ',');

        const postazioni = postazioniRaw
            .split(',')
            .map(p => p.trim())
            .filter(p => p);

        try {
            // UPSERT LOGIC
            // 1. Try by Email if exists
            let existing = null;
            if (email) {
                existing = await prisma.staff.findUnique({ where: { email } });
            }

            // 2. If not found by email, try Nome+Cognome
            if (!existing) {
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
                email: email || undefined,
                ruolo,
                oreMinime: oreMin,
                oreMassime: oreMax,
                costoOra: costo,
                postazioni: postazioni,
                listIndex: i
            };

            if (existing) {
                // Update
                await prisma.staff.update({
                    where: { id: existing.id },
                    data
                });
                // console.log(`Updated ${nome} ${cognome}`);
            } else {
                // Create
                if (!data.email) delete data.email; // Ensure we don't send null if not needed? Prisma handles undefined as "do not set"? No, undefined is "do nothing" in update. In create?
                // In create, undefined on optional field = null.

                await prisma.staff.create({
                    data
                });
                console.log(`Created ${nome} ${cognome}`);
            }
            upserted++;

        } catch (e) {
            console.error(`Error syncing ${nome} ${cognome}:`, e.message);
        }
    }

    console.log(`Synced ${upserted} staff members.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
