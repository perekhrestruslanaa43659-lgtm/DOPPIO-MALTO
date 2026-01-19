const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const rows = await prisma.coverageRow.findMany();
    console.log(`Found ${rows.length} rows.`);
    if (rows.length > 0) {
        const r = rows[0];
        console.log('--- ROW 0 ---');
        console.log('Keys:', Object.keys(r));
        console.log('Slots Type:', typeof r.slots);
        console.log('Extra Type:', typeof r.extra);
        console.log('Slots Value:', r.slots);
        console.log('Extra Value:', r.extra);

        // Try parsing
        try {
            const s = JSON.parse(r.slots);
            console.log('Parsed Slots Type:', typeof s, Array.isArray(s) ? 'Is Array' : 'Not Array');
            if (!Array.isArray(s)) console.log('Content:', s);
        } catch (e) { console.log('Slots Parse Error:', e.message); }

        try {
            const e = JSON.parse(r.extra);
            console.log('Parsed Extra Type:', typeof e, Array.isArray(e) ? 'Is Array' : 'Not Array');
        } catch (err) { console.log('Extra Parse Error:', err.message); }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
