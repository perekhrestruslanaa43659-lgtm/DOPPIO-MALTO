
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'WEEK_TURNI - POSTAZIONI (8).csv');
console.log(`Reading file: ${filePath}`);

try {
    const fileContent = fs.readFileSync(filePath, 'binary');
    const wb = XLSX.read(fileContent, { type: 'binary' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

    console.log(`Found ${json.length} rows.`);

    const newRows: any[] = [];
    const days = ['2026-01-12', '2026-01-13', '2026-01-14', '2026-01-15', '2026-01-16', '2026-01-17', '2026-01-18']; // Mock

    for (let i = 0; i < json.length; i++) {
        const row = json[i];
        if (!row || row.length === 0) continue;

        const station = String(row[0] || '').trim();
        console.log(`Row ${i} Station: '${station}'`); // Debug import

        if (!station || station === 'undefined' || station.startsWith(',')) {
            console.log(`  -> Skipped`);
            continue;
        }

        const slots: Record<string, any> = {};

        days.forEach((day, dIdx) => {
            const base = 2 + (dIdx * 4);
            const lIn = row[base] ? String(row[base]).trim() : '';
            const lOut = row[base + 1] ? String(row[base + 1]).trim() : '';
            const dIn = row[base + 2] ? String(row[base + 2]).trim() : '';
            const dOut = row[base + 3] ? String(row[base + 3]).trim() : '';

            if (i === 6) { // Print details for BARGIU
                console.log(`   Day ${day}: [${base}] ${lIn}-${lOut}, ${dIn}-${dOut}`);
            }
        });

        newRows.push({ station });
    }

    console.log(`Imported ${newRows.length} valid rows.`);

} catch (e: any) {
    console.error("Error:", e);
}
