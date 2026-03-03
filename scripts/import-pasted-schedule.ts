
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Configuration
const WEEK_START = '2026-02-16'; // Monday of Week 8
const TEXT_FILE = 'Week8_User_Paste.txt';

function addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    d.setUTCDate(d.getUTCDate() + days); // Use UTC methods to stay safe
    return d.toISOString().split('T')[0];
}

async function main() {
    console.log(`🚀 Starting TEXT Import for Week 8 (${WEEK_START})...`);

    // 1. Read File
    const filePath = path.join(process.cwd(), TEXT_FILE);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    console.log(`📄 Read ${lines.length} lines.`);

    // 2. Prepare Staff Data
    const staffData: any[] = [];
    const weekEndDate = addDays(WEEK_START, 6);

    let startParsing = false;

    // We look for the first valid staff row essentially.
    // Or we just scan all lines and exclude known headers.

    // Header detection isn't strictly needed if we just skip known keywords.

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Split by TAB
        const cols = line.split('\t').map(c => c.trim());

        if (cols.length < 2) continue; // Need at least Name + Surname

        const col0 = cols[0];
        const col1 = cols[1];

        // Skip Headers / Metadata
        const skipKeywords = [
            'WEEK 8', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica',
            '16-feb', '17-feb',
            'TURNO 1', 'TURNO 2',
            'MANAGER', 'SALA', 'CUCINA', 'ALTRO', 'TASK', 'Varie', 'Eventi CIRCOLO',
            'Totale ore', 'Totale', 'Ore week', 'Produttività'
        ];

        if (skipKeywords.some(k => col0.includes(k) || col1.includes(k))) continue;

        // Also skip empty name/surname
        if (!col0 || !col1) continue;

        // Skip numeric rows (e.g. stats lines if any)
        if (!isNaN(parseFloat(col0))) continue;


        const nome = col0;
        const cognome = col1;

        // Find Staff
        let staff = await prisma.staff.findFirst({
            where: {
                AND: [
                    { nome: { contains: nome, mode: 'insensitive' } },
                    { cognome: { contains: cognome, mode: 'insensitive' } }
                ]
            },
            select: { id: true, tenantKey: true }
        });

        // Typo Fixes
        if (!staff && cognome.toUpperCase().includes('PALNI')) {
            staff = await prisma.staff.findFirst({
                where: { cognome: { contains: 'Palini', mode: 'insensitive' } },
                select: { id: true, tenantKey: true }
            });
        }

        if (staff) {
            staffData.push({
                staff,
                rowCols: cols // Keep original cols
            });
        }
    }

    console.log(`✅ Identified ${staffData.length} staff members to update.`);

    // 3. Clear Data
    const staffIds = staffData.map(s => s.staff.id);
    if (staffIds.length > 0) {
        console.log(`🧹 Clearing existing Week 8 data for identified staff...`);
        // We delete by staffId and date range
        await prisma.assignment.deleteMany({
            where: {
                staffId: { in: staffIds },
                data: { gte: WEEK_START, lte: weekEndDate }
            }
        });
        await prisma.unavailability.deleteMany({
            where: {
                staffId: { in: staffIds },
                data: { gte: WEEK_START, lte: weekEndDate }
            }
        });
    }

    // 4. Import Loops
    let staffCount = 0;
    for (const { staff, rowCols } of staffData) {
        staffCount++;

        // Update List Index
        await prisma.staff.update({
            where: { id: staff.id },
            data: { listIndex: staffCount }
        });

        // Data Columns
        // Name(0), Surname(1)
        // Mon T1 Start(2), End(3), T2 Start(4), End(5)
        // Tue T1 Start(6), End(7), T2 Start(8), End(9)
        // ...

        for (let d = 0; d < 7; d++) {
            const date = addDays(WEEK_START, d);

            const baseIdx = 2 + (d * 4); // 4 cols/day

            // T1
            const t1s = rowCols[baseIdx] || '';
            const t1e = rowCols[baseIdx + 1] || '';

            // T2
            const t2s = rowCols[baseIdx + 2] || '';
            const t2e = rowCols[baseIdx + 3] || '';

            await processShift(staff.id, staff.tenantKey, date, t1s, t1e);
            await processShift(staff.id, staff.tenantKey, date, t2s, t2e);
        }
    }

    console.log(`🏁 Done. Processed ${staffCount} staff.`);
}

async function processShift(staffId: number, tenantKey: string, date: string, startVal: string, endVal: string) {
    // Logic:
    // If startVal is empty -> No shift? 
    // Wait, if it's "R", "FER", "TR MONZA"?
    // Sometimes codes are just in Start column.

    if (!startVal && !endVal) return;

    const val = startVal.toUpperCase();

    // Codes
    if (val === 'R') {
        // Idempotent
        const exists = await prisma.unavailability.findFirst({ where: { staffId, data: date, tipo: 'RIPOSO' } });
        if (!exists) await prisma.unavailability.create({ data: { staffId, tenantKey, data: date, tipo: 'RIPOSO' } });
        return;
    }
    if (val.startsWith('FER')) {
        const exists = await prisma.unavailability.findFirst({ where: { staffId, data: date, tipo: 'FERIE' } });
        if (!exists) await prisma.unavailability.create({ data: { staffId, tenantKey, data: date, tipo: 'FERIE' } });
        return;
    }

    // Notes? "TR MONZA"
    if (val.startsWith('TR')) {
        await prisma.assignment.create({
            data: {
                staffId,
                tenantKey,
                data: date,
                status: true,
                note: val
            }
        });
        return;
    }

    // Time Range
    // Format: Start="10:30", End="18:00"
    // Or Start="10:30 18:00" in one col? 
    // Based on inspection, it seemed tabs separated the times.
    // "10:30" [TAB] "18:00"

    const isTime = (s: string) => /^\d{1,2}[:.]\d{2}$/.test(s);

    if (isTime(startVal) && isTime(endVal)) {
        let s = startVal.replace('.', ':');
        let e = endVal.replace('.', ':');
        if (s.length < 5) s = '0' + s; // 9:00 -> 09:00
        if (e.length < 5) e = '0' + e;

        await prisma.assignment.create({
            data: {
                staffId,
                tenantKey,
                data: date,
                start_time: s,
                end_time: e,
                status: true
            }
        });
        return;
    }

    // Single Value in Start? e.g. "18:00" without end?
    if (isTime(startVal) && !endVal) {
        // Maybe it's a note starting with number? Or just partial data?
        // Let's assume note if single time-like string.
        await prisma.assignment.create({
            data: {
                staffId,
                tenantKey,
                data: date,
                status: true,
                note: startVal
            }
        });
        return;
    }

    // Fallback: Note
    const note = `${startVal} ${endVal}`.trim();
    if (note) {
        await prisma.assignment.create({
            data: {
                staffId,
                tenantKey,
                data: date,
                status: true,
                note: note
            }
        });
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
