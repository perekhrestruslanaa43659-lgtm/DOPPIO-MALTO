const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
    console.log("Starting Full Data Import...");
    console.log("DB URL:", process.env.DATABASE_URL);

    const paths = {
        staff: path.join(__dirname, '../WEEK_TURNI - Foglio17.csv'),
        budget: path.join(__dirname, '../WEEK_TURNI - Forecast (2).csv'),
        coverage: path.join(__dirname, '../WEEK_TURNI - POSTAZIONI (2).csv'),
        shifts: path.join(__dirname, '../WEEK_TURNI - WEEK3.csv')
    };



    // 1. STAFF
    if (fs.existsSync(paths.staff)) {
        console.log(`\n--- Importing Staff from ${paths.staff} ---`);
        await importStaff(paths.staff);
    } else {
        console.log("Staff file not found:", paths.staff);
    }

    // 2. BUDGET
    if (fs.existsSync(paths.budget)) {
        console.log(`\n--- Importing Budget from ${paths.budget} ---`);
        await importBudget(paths.budget);
    } else {
        console.log("Budget file not found:", paths.budget);
    }

    // 3. COVERAGE
    if (fs.existsSync(paths.coverage)) {
        console.log(`\n--- Importing Coverage from ${paths.coverage} ---`);
        await importCoverage(paths.coverage);
    } else {
        console.log("Coverage file not found:", paths.coverage);
    }

    // 4. SHIFTS
    if (fs.existsSync(paths.shifts)) {
        console.log(`\n--- Importing Shifts from ${paths.shifts} ---`);
        await importShifts(paths.shifts);
    } else {
        console.log("Shifts file not found:", paths.shifts);
    }

    console.log("\nImport Complete.");
}

// ------------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------------
function autoParseLine(line) {
    if (!line) return [];
    // Detect separator: Count commas vs semicolons
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

function parseMoney(str) {
    if (!str) return 0;
    // "€ 2.700,00" -> 2700.00
    // Remove "€", spaces, dots. Replace comma with dot.
    let clean = str.replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
}

function parseDateAny(str) {
    if (!str) return null;
    str = str.trim();

    // Format 1: 13/10/2025
    if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3) {
            // DD/MM/YYYY
            const d = parseInt(parts[0]);
            const m = parseInt(parts[1]) - 1;
            const y = parseInt(parts[2]);
            if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
                const date = new Date(y, m, d, 12);
                return date.toISOString().split('T')[0];
            }
        }
    }

    // Format 2: 13-ott
    if (str.includes('-')) {
        const parts = str.split('-');
        const day = parseInt(parts[0]);
        const mStr = parts[1].toLowerCase();
        const map = { 'gen': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'mag': 4, 'giu': 5, 'lug': 6, 'ago': 7, 'set': 8, 'ott': 9, 'nov': 10, 'dic': 11 };
        if (!isNaN(day) && map[mStr] !== undefined) {
            const date = new Date(2025, map[mStr], day, 12);
            return date.toISOString().split('T')[0];
        }
    }

    return null;
}

// ------------------------------------------------------------------
// IMPORT STAFF
// ------------------------------------------------------------------
async function importStaff(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).filter(l => l.trim());

    let created = 0, updated = 0;

    // Skip Header (Line 1)
    for (let i = 1; i < lines.length; i++) {
        const cols = autoParseLine(lines[i]);
        // Nome,Cognome,Email,Ruolo,OreMin,OreMax,Costo,Postazioni
        // Note: CSV Parser might handle quotes, check result.
        if (cols.length < 2) continue;

        const nome = cols[0];
        const cognome = cols[1];
        const email = cols[2];
        const ruolo = cols[3];
        const oreMin = parseInt(cols[4]) || 0;
        const oreMax = parseInt(cols[5]) || 40;
        const costo = parseFloat(cols[6]) || 0;
        // SPLIT STRING INTO ARRAY for Postgres (String[])
        let postazioniRaw = cols[7] || "";
        const postazioni = postazioniRaw.split(',').map(s => s.trim()).filter(Boolean);

        const existing = await prisma.staff.findFirst({
            where: { nome: { equals: nome }, cognome: { equals: cognome } } // Exact match? Or just nome
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
                    postazioni: postazioni
                }
            });
            created++;
        }
    }
    console.log(`Staff Import: Created ${created}, Updated ${updated}.`);
}

// ------------------------------------------------------------------
// IMPORT BUDGET
// ------------------------------------------------------------------
async function importBudget(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    // Find Date Row (Line 6 => Index 5)
    // Find Budget Rows

    // Need to parse specific indices.
    // Col 1 is specific to this file: Starts at Col Index 1 (Monday).
    // "Lunedì" at Index 1.

    let dateRowVals = [];
    let budgetLunchVals = [];
    let budgetDinnerVals = [];
    let budgetDayVals = []; // Total

    // Scan lines to find keys
    // Line 6: Dates
    // Line 7: Budget pranzo
    // Line 10: Budget cena
    // Line 14: Budget day

    // Hardcoded indices based on user provided file view
    // Line index 5 -> Dates
    // Line index 6 -> Lunch
    // Line index 9 -> Dinner
    // Line index 13 -> Day

    if (lines.length < 14) {
        console.log("Budget file too short.");
        return;
    }

    const dateLine = autoParseLine(lines[5]);
    const lunchLine = autoParseLine(lines[6]);
    const dinnerLine = autoParseLine(lines[9]); // Line 10
    const dayLine = autoParseLine(lines[13]); // Line 14

    // Iterate cols 1 to 7 (Mon-Sun)
    let count = 0;
    for (let d = 1; d <= 7; d++) {
        const dateStr = dateLine[d];
        const isoDate = parseDateAny(dateStr);

        if (!isoDate) continue;

        const valLunch = parseMoney(lunchLine[d]);
        const valDinner = parseMoney(dinnerLine[d]);
        const valDay = parseMoney(dayLine[d]);

        // Upsert Budget
        await prisma.budget.upsert({
            where: { data: isoDate },
            update: {
                value: valDay,
                valueLunch: valLunch,
                valueDinner: valDinner,
                hoursLunch: 0, // Not found in CSV explicitly per day
                hoursDinner: 0
            },
            create: {
                data: isoDate,
                value: valDay,
                valueLunch: valLunch,
                valueDinner: valDinner,
                hoursLunch: 0,
                hoursDinner: 0
            }
        });
        count++;
    }
    console.log(`Budget Import: Processed ${count} days.`);
}

// ------------------------------------------------------------------
// IMPORT COVERAGE
// ------------------------------------------------------------------
async function importCoverage(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).filter(l => l.trim());

    await prisma.coverageRow.deleteMany({ where: {} });

    let count = 0;
    // Start Line 5 (Index 4)
    for (let i = 4; i < lines.length; i++) {
        const cols = autoParseLine(lines[i]);
        if (cols.length < 2) continue;
        const station = cols[0];
        if (!station) continue;
        const freq = cols[1];

        // Columns logic similar to previous
        // Lun: 2,3,4,5
        // Step 4
        const slots = {};
        const days = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

        days.forEach((day, idx) => {
            const base = 2 + (idx * 4);
            const daySlots = [];
            // S1
            const s1 = cols[base];
            const e1 = cols[base + 1];
            if (s1 && e1) daySlots.push(`${s1}-${e1}`);

            const s2 = cols[base + 2];
            const e2 = cols[base + 3];
            if (s2 && e2) daySlots.push(`${s2}-${e2}`);

            if (daySlots.length > 0) slots[day] = daySlots;
        });

        const req = cols[30] || "";
        const role = cols[31] || "";
        const note = cols[32] || "";

        await prisma.coverageRow.create({
            data: {
                weekStart: "2025-10-13",
                station,
                frequency: freq,
                slots: JSON.stringify(slots),
                extra: JSON.stringify({ req, role, note })
            }
        });
        count++;
    }
    console.log(`Coverage Import: ${count} rows.`);
}

// ------------------------------------------------------------------
// IMPORT SHIFTS
// ------------------------------------------------------------------
async function importShifts(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).filter(l => l.trim());

    // Dates from Line 2 (Index 1)
    const dateCols = autoParseLine(lines[1]);
    const indices = [2, 7, 12, 17, 22, 27, 32];

    const dates = [];
    indices.forEach(idx => {
        dates.push(parseDateAny(dateCols[idx]));
    });

    // Fallback Dates
    if (dates.some(d => !d)) {
        console.log("Warning: Could not parse all dates from header. Using fallback 13 Oct 2025.");
        const base = new Date(2025, 9, 13, 12);
        for (let k = 0; k < 7; k++) {
            const d = new Date(base);
            d.setDate(base.getDate() + k);
            dates[k] = d.toISOString().split('T')[0];
        }
    }
    console.log("Using Dates:", dates);

    // Clear
    await prisma.assignment.deleteMany({
        where: {
            data: { gte: dates[0], lte: dates[6] }
        }
    });

    let count = 0;
    for (let i = 4; i < lines.length; i++) {
        try {
            const cols = autoParseLine(lines[i]);
            if (cols.length < 2) continue;
            const name = cols[0];
            const surname = cols[1];
            if (!name) continue;

            // Find Staff
            let staff = await prisma.staff.findFirst({ where: { nome: name } }); // Simple match
            if (!staff && surname) {
                staff = await prisma.staff.findFirst({ where: { nome: name, cognome: surname } });
            }

            if (!staff) {
                // Create if missing (Upsert logic in ImportStaff handles this, but here fallback)
                // If ImportStaff ran, we should find them.
                // If checking match by NAME only, maybe failing?
                // let's try creating.
                console.log(`Creating Missing Staff (Shifts): ${name}`);
                staff = await prisma.staff.create({
                    data: { nome: name, cognome: surname || "", ruolo: "STAFF", postazioni: [] }
                });
            }

            // Days
            for (let d = 0; d < 7; d++) {
                const base = indices[d];
                const date = dates[d];
                // check bounds
                if (base + 3 >= cols.length) continue;

                const s1s = cols[base];
                const s1e = cols[base + 1];
                const s2s = cols[base + 2];
                const s2e = cols[base + 3];

                const slots = [];
                if (s1s && s1e) slots.push({ s: s1s, e: s1e });
                if (s2s && s2e) slots.push({ s: s2s, e: s2e });

                for (const slot of slots) {
                    await prisma.assignment.create({
                        data: {
                            staffId: staff.id,
                            data: date,
                            start_time: slot.s,
                            end_time: slot.e,
                            status: false
                        }
                    });
                    count++;
                }
            }
        } catch (err) {
            console.error(`Error processing row ${i}:`, err.message);
        }
    }
    console.log(`Shifts Import: ${count} assignments.`);
}

main()
    .catch(e => console.error("Main Error:", e))
    .finally(() => prisma.$disconnect());
