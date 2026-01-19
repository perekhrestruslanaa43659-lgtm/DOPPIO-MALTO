const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Helper function to parse CSV lines
function autoParseLine(line) {
    if (!line) return [];
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

async function importCoverage(filePath) {
    console.log(`\n📥 Importing Coverage from: ${filePath}`);

    if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${filePath}`);
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).filter(l => l.trim());

    console.log(`   Found ${lines.length} lines in file`);

    // Clear existing coverage data
    const deleted = await prisma.coverageRow.deleteMany({});
    console.log(`   Deleted ${deleted.count} existing coverage rows`);

    let count = 0;
    // Start from line 5 (index 4) - skip headers
    for (let i = 4; i < lines.length; i++) {
        const cols = autoParseLine(lines[i]);
        if (cols.length < 2) continue;

        const station = cols[0];
        if (!station || station.trim() === '') continue;

        const freq = cols[1] || '';

        // Parse slots for each day (Mon-Sun)
        // Columns: Station(0), Freq(1), Mon(2-5), Tue(6-9), Wed(10-13), Thu(14-17), Fri(18-21), Sat(22-25), Sun(26-29)
        const slots = [];
        const days = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

        for (let d = 0; d < 7; d++) {
            const base = 2 + (d * 4);
            // Each day has 4 slots: start1, end1, start2, end2
            const s1 = cols[base] || '';
            const e1 = cols[base + 1] || '';
            const s2 = cols[base + 2] || '';
            const e2 = cols[base + 3] || '';

            if (s1 && e1) slots.push(`${s1}-${e1}`);
            if (s2 && e2) slots.push(`${s2}-${e2}`);
        }

        // Extra fields (requirements, role, notes)
        const req = cols[30] || '';
        const role = cols[31] || '';
        const note = cols[32] || '';

        try {
            await prisma.coverageRow.create({
                data: {
                    weekStart: '2025-10-13', // Default week start
                    station: station.trim(),
                    frequency: freq,
                    slots: slots,
                    extra: { req, role, note }
                }
            });
            count++;
        } catch (error) {
            console.error(`   ⚠️  Error importing row ${i}: ${error.message}`);
        }
    }

    console.log(`   ✅ Imported ${count} coverage rows`);
    return count;
}

async function importBudget(filePath) {
    console.log(`\n📥 Importing Budget from: ${filePath}`);

    if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${filePath}`);
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    if (lines.length < 14) {
        console.log('❌ Budget file too short');
        return;
    }

    // Parse money values
    function parseMoney(str) {
        if (!str) return 0;
        let clean = str.replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.');
        return parseFloat(clean) || 0;
    }

    // Parse dates
    function parseDateAny(str) {
        if (!str) return null;
        str = str.trim();

        if (str.includes('/')) {
            const parts = str.split('/');
            if (parts.length === 3) {
                const d = parseInt(parts[0]);
                const m = parseInt(parts[1]) - 1;
                const y = parseInt(parts[2]);
                if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
                    const date = new Date(y, m, d, 12);
                    return date.toISOString().split('T')[0];
                }
            }
        }

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

    const dateLine = autoParseLine(lines[5]);
    const lunchLine = autoParseLine(lines[6]);
    const dinnerLine = autoParseLine(lines[9]);
    const dayLine = autoParseLine(lines[13]);

    let count = 0;
    for (let d = 1; d <= 7; d++) {
        const dateStr = dateLine[d];
        const isoDate = parseDateAny(dateStr);

        if (!isoDate) continue;

        const valLunch = parseMoney(lunchLine[d]);
        const valDinner = parseMoney(dinnerLine[d]);
        const valDay = parseMoney(dayLine[d]);

        await prisma.budget.upsert({
            where: { data: isoDate },
            update: {
                value: valDay,
                valueLunch: valLunch,
                valueDinner: valDinner,
                hoursLunch: 0,
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

    console.log(`   ✅ Imported ${count} budget records`);
    return count;
}

async function main() {
    console.log('🚀 Starting Data Import...\n');

    const downloadsPath = 'C:\\Users\\rusli\\Downloads';

    const paths = {
        coverage: path.join(downloadsPath, 'WEEK_TURNI - POSTAZIONI (1).csv'),
        budget: path.join(downloadsPath, 'WEEK_TURNI - Forecast (2).csv')
    };

    try {
        // Import Coverage
        await importCoverage(paths.coverage);

        // Import Budget
        await importBudget(paths.budget);

        console.log('\n✅ Import Complete!');

        // Verify
        console.log('\n📊 Verification:');
        const coverageCount = await prisma.coverageRow.count();
        const budgetCount = await prisma.budget.count();
        console.log(`   Coverage rows: ${coverageCount}`);
        console.log(`   Budget records: ${budgetCount}`);

    } catch (error) {
        console.error('❌ Import error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
