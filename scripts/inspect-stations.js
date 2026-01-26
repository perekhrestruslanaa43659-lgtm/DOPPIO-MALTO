
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Fetch all staff and coverage rows to compare stations
    const tenantKey = 'perekhrestruslanaa43659'; // Based on previous context or query first one
    // Actually, let's just fetch all staff
    const staff = await prisma.staff.findMany({ take: 50 });

    console.log('--- Staff Stations ---');
    staff.forEach(s => {
        console.log(`${s.nome} ${s.cognome}: ${s.postazioni} (Raw)`);
    });

    const rows = await prisma.coverageRow.findMany({ take: 50 });
    console.log('\n--- Required Stations in Coverage ---');
    const stationSet = new Set();
    rows.forEach(r => stationSet.add(r.station));
    console.log(Array.from(stationSet));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
