export function getWeekNumber(d: Date = new Date()): number {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((Number(d) - Number(yearStart)) / 86400000) + 1) / 7);
}

export function getWeekRange(w: number, year: number = new Date().getFullYear()) {
    const d = new Date(Date.UTC(year, 0, 4));
    const day = d.getUTCDay() || 7;
    const startOfYear = new Date(d);
    startOfYear.setUTCDate(d.getUTCDate() - day + 1);

    const startD = new Date(startOfYear);
    startD.setUTCDate(startOfYear.getUTCDate() + (w - 1) * 7);

    const start = startD.toISOString().slice(0, 10);
    const endD = new Date(startD);
    endD.setUTCDate(endD.getUTCDate() + 6);
    const end = endD.toISOString().split('T')[0];

    return { start, end, year: startD.getFullYear() };
}

export function getDatesInRange(startDate: string, endDate: string) {
    const dates = [];
    let curr = new Date(startDate);
    const end = new Date(endDate);
    while (curr <= end) {
        dates.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
    }
    return dates;
}

export function getWeeksList(year: number) {
    const arr = [];
    let curr = new Date(Date.UTC(year, 0, 1));
    // Find first Monday
    while (curr.getUTCDay() !== 1) curr.setUTCDate(curr.getUTCDate() + 1);

    const end = new Date(Date.UTC(year + 1, 0, 15)); // Cover full year + overflow
    while (curr < end) {
        const weekNum = getWeekNumber(new Date(curr));
        const range = getWeekRange(weekNum, year); // Ensure year consistency

        // Fix for end of year week overlap
        if (range.start.startsWith(String(year)) || range.end.startsWith(String(year))) {
            arr.push({ week: weekNum, year: year, start: range.start, end: range.end, label: `${weekNum} (${range.start})` });
        }
        curr.setUTCDate(curr.getUTCDate() + 7);
    }
    // Remove duplicates based on start date
    const unique = [];
    const seen = new Set();
    for (const week of arr) {
        if (!seen.has(week.start)) {
            seen.add(week.start);
            unique.push(week);
        }
    }
    return unique;
}
