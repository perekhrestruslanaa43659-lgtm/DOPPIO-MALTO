
const { PrismaClient } = require('@prisma/client');
// Manually implement getISOWeek to avoid import issues in script context
function getISOWeek(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

const prisma = new PrismaClient();

async function main() {
    console.log('--- Debugging Ruslana Fixed Shifts (JS Mode) ---');

    // 1. Find Ruslana
    const ruslana = await prisma.staff.findFirst({
        where: { nome: { contains: 'Ruslana', mode: 'insensitive' } }
    });

    if (!ruslana) {
        console.log('Staff "Ruslana" not found.');
        return;
    }

    console.log(`Found Staff: ${ruslana.nome} ${ruslana.cognome} (ID: ${ruslana.id})`);

    // 2. Fetch Recurring Shifts
    const fixedShifts = await prisma.recurringShift.findMany({
        where: { staffId: ruslana.id }
    });

    console.log(`Found ${fixedShifts.length} Recurring Shifts.`);
    fixedShifts.forEach(f => {
        console.log(`- ID: ${f.id}, Day: ${f.dayOfWeek}, Time: ${f.start_time}-${f.end_time}, W: ${f.startWeek}-${f.endWeek}, Y: ${f.startYear}-${f.endYear}`);
    });

    // 3. Simulate Validity Check
    const startD = new Date();
    const endD = new Date();
    endD.setDate(endD.getDate() + 7);

    let dLoop = new Date(startD);
    while (dLoop <= endD) {
        const dateStr = dLoop.toISOString().split('T')[0];
        const dayOfWeek = dLoop.getDay() || 7;
        const currentYear = dLoop.getFullYear();
        const currentWeek = getISOWeek(dLoop);

        console.log(`\nChecking Date: ${dateStr} (Day: ${dayOfWeek}, Week: ${currentWeek}, Year: ${currentYear})`);

        const match = fixedShifts.find(r => {
            if (r.dayOfWeek !== dayOfWeek) return false;

            let valid = true;
            if (r.startYear && currentYear < r.startYear) valid = false;
            if (r.endYear && currentYear > r.endYear) valid = false;
            if (r.startWeek && currentWeek < r.startWeek) valid = false;
            if (r.endWeek && currentWeek > r.endWeek) valid = false;

            if (!valid) console.log(`  -> Invalid ID ${r.id}: Range W${r.startWeek}-${r.endWeek} Y${r.startYear}-${r.endYear}`);
            return valid;
        });

        if (match) {
            console.log(`  => ACTIVE: ${match.start_time} - ${match.end_time}`);
        } else {
            console.log(`  => NONE.`);
        }

        dLoop.setDate(dLoop.getDate() + 1);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
