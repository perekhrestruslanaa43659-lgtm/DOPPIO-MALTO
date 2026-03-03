
function getWeekRange(w: number, year: number) {
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

console.log('Week 6, 2026:', getWeekRange(6, 2026));
console.log('Week 1, 2026:', getWeekRange(1, 2026));
console.log('Week 5, 2026:', getWeekRange(5, 2026));
