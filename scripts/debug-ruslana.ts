
const { PrismaClient } = require('@prisma/client');
const { getISOWeek } = require('date-fns');

const prisma = new PrismaClient();

async function main() {
    console.log('--- Debugging Ruslana Fixed Shifts ---');

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

    // 3. Simulate Validity Check for today/tomorrow
    const testDate = new Date(); // Or specific date if user implied
    // User complaint is general, let's test a generic week. 
    // Let's test the next 7 days.

    // Mock the Scheduler Loop
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

            console.log(`  -> Found Shift candidate for Day ${dayOfWeek} (ID: ${r.id})`);
            console.log(`     Range: W${r.startWeek || '?'}-W${r.endWeek || '?'} Y${r.startYear || '?'}-Y${r.endYear || '?'}`);

            let valid = true;
            if (r.startYear && currentYear < r.startYear) { console.log('     FAIL: Year < Start'); valid = false; }
            if (r.endYear && currentYear > r.endYear) { console.log('     FAIL: Year > End'); valid = false; }
            if (r.startWeek && currentWeek < r.startWeek) { console.log('     FAIL: Week < Start'); valid = false; }
            if (r.endWeek && currentWeek > r.endWeek) { console.log('     FAIL: Week > End'); valid = false; }

            if (valid) console.log('     PASS: Valid!');
            return valid;
        });

        if (match) {
            console.log(`  => ACTIVE FIXED SHIFT: ${match.start_time} - ${match.end_time}`);
        } else {
            console.log(`  => NO ACTIVE FIXED SHIFT.`);
        }

        dLoop.setDate(dLoop.getDate() + 1);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
