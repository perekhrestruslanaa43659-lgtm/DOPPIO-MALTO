const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Starting Cleanup...");

    // 1. Delete Junk Rows (IDs 82-85 or Name starting with | or empty)
    // The user was specific about 82-85.
    const deleted = await prisma.staff.deleteMany({
        where: {
            OR: [
                { id: { in: [82, 83, 84, 85] } },
                { nome: { startsWith: '|' } },
                { nome: { startsWith: 'Creating' } } // Just in case
            ]
        }
    });
    console.log(`Deleted ${deleted.count} junk records.`);

    // 2. Remove "Lavaggio" from Postazioni
    const allStaff = await prisma.staff.findMany();
    let updatedCount = 0;

    for (const s of allStaff) {
        if (!s.postazioni || s.postazioni.length === 0) continue;

        // Filter out "lavaggio" (case insensitive)
        const newPostazioni = s.postazioni.filter(p => !p.toLowerCase().includes('lavaggio'));

        if (newPostazioni.length !== s.postazioni.length) {
            console.log(`Removing Lavaggio from ${s.nome} ${s.cognome}`);
            await prisma.staff.update({
                where: { id: s.id },
                data: { postazioni: newPostazioni }
            });
            updatedCount++;
        }
    }
    console.log(`Removed Lavaggio from ${updatedCount} staff members.`);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
