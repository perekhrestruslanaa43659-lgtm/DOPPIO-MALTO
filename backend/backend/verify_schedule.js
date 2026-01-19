const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// REUSE SCHEDULER HELPERS
function parseTime(t) {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h + (m || 0) / 60;
}
function formatTime(dec) {
    if (dec === undefined || dec === null) return "00:00";
    const h = Math.floor(dec);
    const m = Math.round((dec - h) * 60);
    const mm = m < 10 ? '0' + m : m;
    const hh = h < 10 ? '0' + h : h;
    return `${hh}:${mm}`;
}

async function verify(startDate, endDate) {
    const coverageRows = await prisma.coverageRow.findMany();
    const assignments = await prisma.assignment.findMany({
        where: {
            data: { gte: startDate, lte: endDate }
        },
        include: { staff: true }
    });

    const parsedCoverage = coverageRows.map(r => ({
        ...r,
        slots: typeof r.slots === 'string' ? JSON.parse(r.slots) : r.slots
    }));

    const curr = new Date(startDate);
    const end = new Date(endDate);
    const dayShorts = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

    const gaps = [];

    while (curr <= end) {
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, '0');
        const d = String(curr.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        const dayIndex = curr.getDay(); // 0=Sun
        const dayName = dayShorts[dayIndex];

        // 1. Build Demand
        const demandList = [];
        parsedCoverage.forEach(row => {
            const slots = row.slots;
            let daySlots = [];
            if (Array.isArray(slots)) {
                let dayOffset = (dayIndex === 0) ? 28 : dayIndex * 4;
                daySlots.push(slots[dayOffset], slots[dayOffset + 1], slots[dayOffset + 2], slots[dayOffset + 3]);
            } else if (slots && typeof slots === 'object') {
                const shifts = slots[dayName] || [];
                if (shifts[0]) daySlots.push(...shifts[0].split('-'));
                if (shifts[1]) daySlots.push(...shifts[1].split('-'));
            }

            for (let i = 0; i < daySlots.length; i += 2) {
                const sTime = daySlots[i];
                const eTime = daySlots[i + 1];
                if (!sTime || !eTime || !sTime.includes(':')) continue;

                const startDec = parseTime(sTime);
                let endDec = parseTime(eTime);
                if (endDec < startDec) endDec += 24;

                const qty = parseInt(row.frequency) || 1;
                for (let q = 0; q < qty; q++) {
                    demandList.push({
                        station: row.station,
                        start: startDec,
                        end: endDec,
                        originalStr: `${sTime}-${eTime}`
                    });
                }
            }
        });

        // 2. Check Assignments
        const dayAssignments = assignments.filter(a => a.data === dateStr);

        // Naive Matching: Greedy match
        // For each demand, find an unconsumed assignment that fits.
        // Fit means: Station match (approx) AND Time Overlap (significant?) or strict?
        // Let's assume Generated Shifts match exactly or close.
        // Station match: "B/S" matches "B/S_V"? No, normalized.

        const usedAsnIds = new Set();

        demandList.forEach(demand => {
            const dStation = demand.station.trim().toUpperCase().split(/[_:]/)[0]; // Normalize

            const match = dayAssignments.find(a => {
                if (usedAsnIds.has(a.id)) return false;

                // Station Check
                const aStation = (a.postazione || '').trim().toUpperCase().split(/[_:]/)[0];
                if (aStation !== dStation) return false;

                // Time Check
                // Assignment time might be customStart or template
                // We need to fetch template if custom is null.
                // But simplified: existing `assignment` object doesn't include template info by default unless included.
                // We fetched with `include: { staff: true }`. We need `shiftTemplate`.
                // Assume logic checks customStart/End. (Which generator sets).

                let s = 0, e = 0;
                if (a.start_time) {
                    s = parseTime(a.start_time);
                    e = parseTime(a.end_time);
                } else {
                    // If using template, we don't have it here logic wise unless we include it.
                    // We'll trust custom fields for generated shifts.
                }
                if (e < s) e += 24;

                // Check Overlap
                // demand start/end vs assignment s/e
                // Strict match? abs(s - demand.start) < 0.5?
                if (Math.abs(s - demand.start) < 0.1 && Math.abs(e - demand.end) < 0.1) return true;

                return false;
            });

            if (match) {
                usedAsnIds.add(match.id);
            } else {
                gaps.push({
                    date: dateStr,
                    station: demand.station,
                    start: formatTime(demand.start),
                    end: formatTime(demand.end),
                    reason: "No assignment found"
                });
            }
        });

        curr.setDate(curr.getDate() + 1);
    }

    console.log("GAPS FOUND:", gaps.length);
    if (gaps.length > 0) console.log(gaps.slice(0, 5));
}

verify('2025-10-13', '2025-10-19')
    .catch(console.error)
    .finally(() => prisma.$disconnect());
