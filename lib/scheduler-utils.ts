
import { CoverageRow } from '@prisma/client';

export type ShiftTask = {
    date: string;
    start: string;
    end: string;
    station: string;
    type: 'LUNCH' | 'DINNER';
};

export function toMinutes(time: string) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

export function generateTasksFromCoverage(coverageRows: CoverageRow[], startDate: string, endDate: string): ShiftTask[] {
    const tasks: ShiftTask[] = [];
    const startD = new Date(startDate);
    const endD = new Date(endDate);

    let curr = new Date(startD);
    while (curr <= endD) {
        const dateStr = curr.toISOString().split('T')[0];

        // Find rows for this week
        // Simplified matching: check if row has slot for this date
        const activeRows = coverageRows.filter(r => {
            const slots = JSON.parse(r.slots);
            return !!slots[dateStr];
        });

        for (const row of activeRows) {
            const slots = JSON.parse(row.slots);
            const day = slots[dateStr];
            if (!day) continue;

            let isActive = true;
            try { if (JSON.parse(row.extra).active === false) isActive = false; } catch { }
            if (!isActive) continue;

            if (day.lIn && day.lOut) tasks.push({ date: dateStr, start: day.lIn, end: day.lOut, station: row.station, type: 'LUNCH' });
            if (day.dIn && day.dOut) tasks.push({ date: dateStr, start: day.dIn, end: day.dOut, station: row.station, type: 'DINNER' });
        }

        curr.setDate(curr.getDate() + 1);
    }

    // Deduplicate
    const uniqueTasks: ShiftTask[] = [];
    const taskKeys = new Set<string>();

    for (const task of tasks) {
        const key = `${task.date}|${task.start}|${task.end}|${task.station}|${task.type}`;
        if (!taskKeys.has(key)) {
            taskKeys.add(key);
            uniqueTasks.push(task);
        }
    }

    return uniqueTasks;
}
