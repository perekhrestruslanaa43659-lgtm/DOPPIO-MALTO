const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

function autoParseLine(line) {
    if (!line) return [];
    // Simple CSV parser respecting quotes
    const commas = (line.match(/,/g) || []).length;
    const semis = (line.match(/;/g) || []).length;
    const sep = semis > commas ? ';' : ',';

    const res = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            inQuote = !inQuote;
        } else if (c === sep && !inQuote) {
            res.push(cur.trim());
            cur = '';
        } else {
            cur += c;
        }
    }
    res.push(cur.trim());
    return res;
}

async function main() {
    console.log("Starting Clean Staff Import...");
    const filePath = path.join(__dirname, '../WEEK_TURNI - Foglio17.csv');

    if (!fs.existsSync(filePath)) {
        console.error("File not found:", filePath);
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).filter(l => l.trim());

    let created = 0, updated = 0;

    for (let i = 1; i < lines.length; i++) {
        const cols = autoParseLine(lines[i]);
        if (cols.length < 2) continue;

        const nome = cols[0];
        const cognome = cols[1];
        const email = cols[2];
        const ruolo = cols[3];
        const oreMin = parseInt(cols[4]) || 0;
        const oreMax = parseInt(cols[5]) || 40;
        const costo = parseFloat(cols[6]) || 0;

        // Explicitly force Array of Strings
        let postazioniRaw = cols[7] || "";
        // If it looks like "BAR, KITCHEN", split it.
        const postazioni = postazioniRaw.split(',').map(s => s.trim()).filter(Boolean);

        // console.log(`Importing: ${nome} ${cognome} Postazioni: '${postazioni}'`);

        try {
            const existing = await prisma.staff.findFirst({
                where: { nome: { equals: nome }, cognome: { equals: cognome } }
            });

            if (existing) {
                await prisma.staff.update({
                    where: { id: existing.id },
                    data: {
                        email: email || existing.email,
                        ruolo: ruolo,
                        oreMinime: oreMin,
                        oreMassime: oreMax,
                        costoOra: costo,
                        postazioni: postazioni
                    }
                });
                updated++;
            } else {
                await prisma.staff.create({
                    data: {
                        nome, cognome, email, ruolo,
                        oreMinime: oreMin, oreMassime: oreMax, costoOra: costo,
                        postazioni: postazioni,
                        ruolo: ruolo
                    }
                });
                created++;
            }
        } catch (e) {
            console.error(`Error on row ${i} (${nome}):`, e.message);
        }
    }
    console.log(`Done. Created: ${created}, Updated: ${updated}`);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
