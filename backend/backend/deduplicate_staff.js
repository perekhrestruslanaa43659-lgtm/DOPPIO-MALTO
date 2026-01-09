const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Starting deduplication...");

    const allStaff = await prisma.staff.findMany({
        orderBy: { id: 'asc' }
    });

    const map = new Map(); // Key: "NOME COGNOME", Value: [staffObj]

    for (const s of allStaff) {
        const key = `${s.nome.trim().toUpperCase()} ${s.cognome.trim().toUpperCase()}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(s);
    }

    let deletedCount = 0;

    for (const [key, list] of map.entries()) {
        if (list.length > 1) {
            console.log(`Found duplicates for ${key}: ${list.length}`);

            // Strategy: Keep the one with the real email (not placeholder), or the latest one, or the one with OreMassime updated.
            // Foglio17 import used REAL emails. Previous used placeholder.
            // let's score them.

            const sorted = list.sort((a, b) => {
                const aIsReal = a.email && !a.email.includes('placeholder.com');
                const bIsReal = b.email && !b.email.includes('placeholder.com');
                if (aIsReal && !bIsReal) return -1; // a comes first (keep)
                if (!aIsReal && bIsReal) return 1;  // b comes first
                return b.id - a.id; // if both same type, keep latest
            });

            const toKeep = sorted[0];
            const toDelete = sorted.slice(1);

            console.log(`Keeping: ${toKeep.nome} (${toKeep.email})`);

            for (const d of toDelete) {
                console.log(`Deleting: ${d.nome} (${d.email})`);
                await prisma.staff.delete({ where: { id: d.id } });
                deletedCount++;
            }
        }
    }

    console.log(`Deduplication finished. Deleted ${deletedCount} duplicate entries.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
