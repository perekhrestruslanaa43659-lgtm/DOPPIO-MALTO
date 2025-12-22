const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FILE_PATH = '../WEEK_TURNI - POSTAZIONI (2).csv';

async function main() {
    const content = fs.readFileSync(FILE_PATH, 'utf-8');
    const lines = content.split('\n');

    // We will upsert or recreate. To avoid ID drift if possible, we might check name+times.
    // But to be clean and update constraints, let's just wipe and recreate?
    // User might have defined assignments linked to IDs. Wiping breaks assignments.
    // BETTER: Update valid days if exists, create if not.

    // Mapping: Name -> { start, end, days: Set() }
    const templateMap = new Map(); // Key: "Name|Start|End" -> Object

    // Helper: JS Day 0=Sun, 1=Mon...
    // CSV Columns:
    // Mon (1): Cols 2,3,4,5
    // Tue (2): Cols 6,7,8,9
    // Wed (3): Cols 10,11,12,13
    // Thu (4): Cols 14,15,16,17
    // Fri (5): Cols 18,19,20,21
    // Sat (6): Cols 22,23,24,25
    // Sun (0): Cols 26,27,28,29

    const dayMap = [1, 2, 3, 4, 5, 6, 0]; // Order in CSV rows

    for (let i = 4; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',');
        const baseName = cols[0];
        if (!baseName) continue;

        let colIdx = 2;
        for (let d = 0; d < 7; d++) {
            const jsDay = dayMap[d];

            // Shift 1
            let s1 = cols[colIdx]?.trim();
            let e1 = cols[colIdx + 1]?.trim();
            if (s1 && e1 && s1.match(/\d:\d/) && e1.match(/\d:\d/)) {
                const key = `${baseName}|${s1}|${e1}`;
                if (!templateMap.has(key)) templateMap.set(key, { nome: baseName, start: s1, end: e1, days: new Set() });
                templateMap.get(key).days.add(jsDay);
            }

            // Shift 2
            let s2 = cols[colIdx + 2]?.trim();
            let e2 = cols[colIdx + 3]?.trim();
            if (s2 && e2 && s2.match(/\d:\d/) && e2.match(/\d:\d/)) {
                const key = `${baseName}|${s2}|${e2}`;
                if (!templateMap.has(key)) templateMap.set(key, { nome: baseName, start: s2, end: e2, days: new Set() });
                templateMap.get(key).days.add(jsDay);
            }

            colIdx += 4;
        }
    }

    console.log(`Processing ${templateMap.size} templates...`);

    for (const t of templateMap.values()) {
        const validDays = Array.from(t.days);

        const existing = await prisma.shiftTemplate.findFirst({
            where: { nome: t.nome, oraInizio: t.start, oraFine: t.end }
        });

        if (existing) {
            // Update days
            await prisma.shiftTemplate.update({
                where: { id: existing.id },
                data: { giorniValidi: validDays }
            });
            console.log(`Updated ${t.nome}: Days [${validDays}]`);
        } else {
            // Create
            await prisma.shiftTemplate.create({
                data: {
                    nome: t.nome,
                    oraInizio: t.start,
                    oraFine: t.end,
                    ruoloRichiesto: 'Generico',
                    giorniValidi: validDays
                }
            });
            console.log(`Created ${t.nome}: Days [${validDays}]`);
        }
    }
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(async () => { await prisma.$disconnect(); });
