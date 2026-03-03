
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Configuration
const WEEK_START = '2026-02-16'; // Monday of Week 8
const CSV_FILE = 'Week 8(WEEK 8).csv';

function addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
}

async function main() {
    console.log(`🚀 Starting CSV Import for Week 8 (${WEEK_START})...`);

    // 1. Read File
    const filePath = path.join(process.cwd(), CSV_FILE);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        return;
    }

    const content = fs.readFileSync(filePath, 'latin1');
    const lines = content.split(/\r?\n/);
    console.log(`📄 Read ${lines.length} lines.`);

    // 2. Identify Structure
    let headerRowIndex = -1;
    let dataStartRow = -1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('TURNO 1')) {
            headerRowIndex = i;
            dataStartRow = i + 1;
            break;
        }
    }

    if (headerRowIndex === -1) {
        console.error("❌ Could not find header row with 'TURNO 1'. Aborting.");
        return;
    }

    // 3. Collect Staff & Prepare for Import
    const staffData = [];
    const weekEndDate = addDays(WEEK_START, 6);

    for (let i = dataStartRow; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(';');
        const cleanCols = cols.map(c => c.trim());

        const col0 = cleanCols[0] || '';
        const col1 = cleanCols[1] || '';

        // Skip metadata/sections
        if ((col0.includes('MANAGER') || col0.includes('SALA') || col0.includes('CUCINA')) && !col1) continue;
        if (!col0 || !col1) continue;
        if (['TASK', 'Varie', 'Eventi CIRCOLO', 'Totale ore', 'Totale', 'Ore week'].includes(col0)) continue;
        if (!isNaN(parseFloat(col0))) continue; // Skip numeric summary rows

        const nome = col0;
        const cognome = col1;

        // Find Staff with TenantKey
        let staff = await prisma.staff.findFirst({
            where: {
                AND: [
                    { nome: { contains: nome, mode: 'insensitive' } },
                    { cognome: { contains: cognome, mode: 'insensitive' } }
                ]
            },
            select: { id: true, tenantKey: true }
        });

        if (!staff && cognome.toUpperCase().includes('PALNI')) {
            staff = await prisma.staff.findFirst({
                where: { cognome: { contains: 'Palini', mode: 'insensitive' } },
                select: { id: true, tenantKey: true }
            });
        }

        if (staff) {
            staffData.push({
                staff,
                rowCols: cleanCols
            });
        }
    }

    console.log(`✅ Identified ${staffData.length} staff members to update.`);

    // 4. Clear Data for these staff only
    const staffIds = staffData.map(s => s.staff.id);
    if (staffIds.length > 0) {
        console.log(`🧹 Clearing existing Week 8 data for identified staff...`);
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

    // 5. Import
    let staffCount = 0;
    for (const { staff, rowCols } of staffData) {
        staffCount++;

        // Use listIndex from loop order? The loop order is file order.
        await prisma.staff.update({
            where: { id: staff.id },
            data: { listIndex: staffCount }
        });

        for (let d = 0; d < 7; d++) {
            const date = addDays(WEEK_START, d);
            const colIdx = 2 + (d * 2);

            const t1 = rowCols[colIdx];
            const t2 = rowCols[colIdx + 1];

            await processShiftCell(staff.id, staff.tenantKey, date, t1);
            await processShiftCell(staff.id, staff.tenantKey, date, t2);
        }
    }

    console.log(`🏁 Done. Processed ${staffCount} staff.`);
}

async function processShiftCell(staffId: number, tenantKey: string, date: string, raw: string) {
    if (!raw) return;

    const val = raw.toUpperCase();

    if (val === 'R') {
        const exists = await prisma.unavailability.findFirst({ where: { staffId, data: date, tipo: 'RIPOSO' } });
        if (!exists) await prisma.unavailability.create({ data: { staffId, tenantKey, data: date, tipo: 'RIPOSO' } });
        return;
    }
    if (val.startsWith('FER')) {
        const exists = await prisma.unavailability.findFirst({ where: { staffId, data: date, tipo: 'FERIE' } });
        if (!exists) await prisma.unavailability.create({ data: { staffId, tenantKey, data: date, tipo: 'FERIE' } });
        return;
    }

    const timePattern = /(\d{1,2}[:.]\d{2})\s+(\d{1,2}[:.]\d{2})/;
    const match = raw.match(timePattern);

    if (match) {
        let s = match[1].replace('.', ':');
        let e = match[2].replace('.', ':');
        if (s.indexOf(':') === 1) s = '0' + s;
        if (e.indexOf(':') === 1) e = '0' + e;

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
    } else {
        await prisma.assignment.create({
            data: {
                staffId,
                tenantKey,
                data: date,
                status: true,
                note: raw
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
