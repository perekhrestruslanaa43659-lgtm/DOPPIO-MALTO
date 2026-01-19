const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
    console.log("--- DEBUGGING MONDAY SCHEDULE ---");

    // 1. Fetch Staff
    const staff = await prisma.staff.findMany();
    console.log(`\n1. Found ${staff.length} Staff:`);
    staff.forEach(s => console.log(`   - ${s.nome} (ID ${s.id})`));

    // 2. Fetch Coverage
    const coverage = await prisma.coverageRow.findMany();
    console.log(`\n2. Found ${coverage.length} Coverage Rows:`);

    // Simulate Monday Demand Extraction
    const demandList = [];
    const dayIndex = 1; // Monday

    coverage.forEach(row => {
        const slots = row.slots;
        console.log(`   > Row ID ${row.id} (${row.station}): Type ${typeof slots}, IsArray? ${Array.isArray(slots)}`);
        console.log(`     Value: ${JSON.stringify(slots)}`);

        let dayOffset = (dayIndex - 1) * 4; // 0 for Mon
        if (Array.isArray(slots)) {
            const daySlots = slots.slice(dayOffset, dayOffset + 4);
            console.log(`     Monday Raw: ${JSON.stringify(daySlots)}`);

            daySlots.forEach(s => {
                if (s) demandList.push({ station: row.station, time: s });
            });
        }
    });

    console.log(`\n3. Generated ${demandList.length} Demand Items for Monday:`);
    demandList.forEach(d => console.log(`   - NEED: ${d.station} @ ${d.time}`));

    // 4. Match Simulation
    console.log("\n4. SIMULATING MATCHING...");
    demandList.forEach((demand, i) => {
        console.log(`\n   DEMAND #${i}: ${demand.station} (${demand.time})`);
        const canDo = staff.filter(s => {
            const hasStation = (s.postazioni || []).some(p => p.trim().toLowerCase() === demand.station.trim().toLowerCase());
            return hasStation;
        });

        console.log(`     -> Candidates with Station '${demand.station}': ${canDo.length}`);
        canDo.forEach(c => console.log(`        * ${c.nome} (ID ${c.id})`));

        if (canDo.length === 0) {
            console.log("     !!! NO CANDIDATES CAPABLE !!! (Check spelling?)");
        }
    });
}

debug();
