
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    const weekStart = '2026-02-02';
    const oldSunday = '2026-02-01'; // The Sunday that shouldn't be there
    const newSunday = '2026-02-08'; // The Sunday that is missing

    const debugLog: string[] = [];
    debugLog.push(`🔧 Fixing coverage for week ${weekStart}...`);

    // Fetch ALL rows for that week, ignoring tenant filter to be safe/thorough
    const rows = await prisma.coverageRow.findMany({
        where: { weekStart }
    });

    debugLog.push(`Found ${rows.length} rows for week ${weekStart}`);

    let validFixes = 0;

    for (const row of rows) {
        let slots: any = {};
        if (typeof row.slots === 'string') {
            try {
                slots = JSON.parse(row.slots);
            } catch (e: any) {
                debugLog.push(`Error parsing slots for row ${row.id}: ${e.message}`);
                continue;
            }
        } else {
            slots = row.slots;
        }

        let changed = false;
        debugLog.push(`Checking ${row.station} (ID: ${row.id}, Tenant: ${row.tenantKey})`);

        // Detailed key check
        const keys = Object.keys(slots);
        debugLog.push(`  Current Keys: ${keys.join(', ')}`);

        // Check if we have data for the "Wrong Sunday"
        if (slots[oldSunday]) {
            debugLog.push(`  Found old Sunday ${oldSunday} with data.`);

            // Check if "Right Sunday" is missing OR if we want to force overwrite
            // Let's be safe: if newSunday is missing, definitely move.
            // If newSunday exists, check if it's empty? 
            // For now, assume if old exists and new is missing, we move.

            if (!slots[newSunday]) {
                debugLog.push(`  Moving to new Sunday ${newSunday}`);
                slots[newSunday] = slots[oldSunday];
                delete slots[oldSunday];
                changed = true;
                validFixes++;
            } else {
                debugLog.push(`  New Sunday ${newSunday} already exists! Skipping overwrite to avoid data loss.`);
                // If you want to force: 
                // slots[newSunday] = slots[oldSunday]; delete slots[oldSunday]; changed=true;
            }
        } else {
            debugLog.push(`  No old Sunday data found.`);
        }

        if (changed) {
            await prisma.coverageRow.update({
                where: { id: row.id },
                data: {
                    slots: JSON.stringify(slots)
                }
            });
            debugLog.push(`  ✅ Updated DB for ${row.station}`);
        }
    }

    const logContent = debugLog.join('\n');
    fs.writeFileSync('fix_log.txt', logContent);
    console.log(`✅ Fixed ${validFixes} rows. Log written to fix_log.txt`);
}

main()
    .catch(e => {
        console.error(e);
        fs.writeFileSync('fix_log_error.txt', String(e));
    })
    .finally(async () => await prisma.$disconnect());
