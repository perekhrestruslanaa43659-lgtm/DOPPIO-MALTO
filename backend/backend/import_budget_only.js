const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

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

function parseMoney(str) {
    if (!str) return 0;
    let clean = str.replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
}

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

async function importBudget(filePath) {
    console.log(`\n📥 Importing Budget from: ${filePath}`);

    if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${filePath}`);
        return 0;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    if (lines.length < 14) {
        console.log('❌ Budget file too short');
        return 0;
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

        try {
            // Use raw SQL to avoid schema issues
            await prisma.$executeRaw`
                INSERT INTO "Budget" (data, value, "valueLunch", "valueDinner", "hoursLunch", "hoursDinner")
                VALUES (${isoDate}, ${valDay}, ${valLunch}, ${valDinner}, 0, 0)
                ON CONFLICT (data) 
                DO UPDATE SET 
                    value = ${valDay},
                    "valueLunch" = ${valLunch},
                    "valueDinner" = ${valDinner}
            `;
            count++;
        } catch (error) {
            console.error(`   ⚠️  Error importing date ${isoDate}: ${error.message}`);
        }
    }

    console.log(`   ✅ Imported ${count} budget records`);
    return count;
}

async function main() {
    console.log('🚀 Starting Budget Import...\n');

    const downloadsPath = 'C:\\Users\\rusli\\Downloads';
    const budgetPath = path.join(downloadsPath, 'WEEK_TURNI - Forecast (2).csv');

    try {
        const count = await importBudget(budgetPath);

        console.log('\n✅ Budget Import Complete!');

        // Verify
        console.log('\n📊 Verification:');
        const budgetCount = await prisma.budget.count();
        const coverageCount = await prisma.coverageRow.count();
        console.log(`   Budget records: ${budgetCount}`);
        console.log(`   Coverage rows: ${coverageCount}`);

    } catch (error) {
        console.error('❌ Import error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
