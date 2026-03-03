
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';
import { getISOWeek, startOfWeek, addDays, format } from 'date-fns';

// Helper for Fuzzy Match
function findStaffId(name: string, staffList: any[]): number | null {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
    const target = normalize(name);

    // 1. Exact Match on normalized
    const exact = staffList.find(s => normalize(s.nome + (s.cognome || '')) === target || normalize(s.nome) === target);
    if (exact) return exact.id;

    // 2. Contains Match (if unambiguous)
    const contains = staffList.filter(s => normalize(s.nome + (s.cognome || '')).includes(target) || target.includes(normalize(s.nome)));
    if (contains.length === 1) return contains[0].id;

    return null;
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const tenantKey = 'perekhrestruslanaa43659-lgtm/DOPPIO-MALTO'; // Hardcoded for now or fetch from session if available

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });

        // Assume first sheet
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const rawData = XLSX.utils.sheet_to_json(sheet);

        // Fetch Staff for mapping
        const staffList = await prisma.staff.findMany({ where: { tenantKey } });

        const importedWeeks = new Map<string, any[]>(); // WeekStart -> Assignments

        let successCount = 0;
        let failCount = 0;

        rawData.forEach((row: any) => {
            // Expected Columns: Date (YYYY-MM-DD or Excel Serial), Staff, Station, Start, End
            // Adaptive mapping:
            const dateVal = row['Date'] || row['Data'] || row['Giorno'];
            const staffName = row['Staff'] || row['Nome'] || row['Dipendente'];
            const station = row['Station'] || row['Postazione'] || row['Mansione'];
            const start = row['Start'] || row['Inizio'] || row['Ora Inizio'];
            const end = row['End'] || row['Fine'] || row['Ora Fine'];

            if (!dateVal || !staffName || !station) {
                failCount++;
                return;
            }

            // Parse Date
            let dateStr = '';
            if (typeof dateVal === 'number') {
                // Excel serial date
                const d = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
                dateStr = d.toISOString().split('T')[0];
            } else {
                // String or other
                const d = new Date(dateVal);
                if (isNaN(d.getTime())) { failCount++; return; }
                dateStr = d.toISOString().split('T')[0];
            }

            // Map Staff
            const staffId = findStaffId(String(staffName), staffList);
            if (!staffId) {
                failCount++;
                return;
            }

            // Calculate Week Start (Monday)
            const inputDate = new Date(dateStr);
            const weekStart = startOfWeek(inputDate, { weekStartsOn: 1 }).toISOString().split('T')[0];

            if (!importedWeeks.has(weekStart)) importedWeeks.set(weekStart, []);

            importedWeeks.get(weekStart)!.push({
                staffId,
                data: dateStr,
                start_time: String(start || '00:00'),
                end_time: String(end || '00:00'),
                postazione: String(station),
                shiftTemplateId: null,
                status: false,
                tenantKey
            });
            successCount++;
        });

        // Save to DB
        // Determine "WeekStart" for grouping.
        // We might have multiple weeks in one file.
        // Save each week as a TrainingData entry.

        for (const [weekStart, tasks] of importedWeeks.entries()) {
            await prisma.trainingData.create({
                data: {
                    date: new Date(), // Import Timestamp
                    weekStart: weekStart,
                    data: JSON.stringify(tasks),
                    rating: 5, // High confidence for historical data
                    tenantKey
                }
            });
        }

        return NextResponse.json({
            success: true,
            importedRows: successCount,
            failedRows: failCount,
            weeksCovered: importedWeeks.size
        });

    } catch (error) {
        console.error('Import Error:', error);
        return NextResponse.json({ error: 'Failed to process file' }, { status: 500 });
    }
}
