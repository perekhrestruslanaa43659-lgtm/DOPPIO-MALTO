const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const staff = await prisma.staff.findMany({
        orderBy: { id: 'asc' }
    });
    console.log(`Total Staff: ${staff.length}`);
    staff.forEach((s, i) => {
        // Show last 10 rows or if index is high to match user description "82-85"
        // Wait, user might mean spreadsheet rows or UI rows.
        // If import created 36 staff, 82-85 seems high.
        // Maybe they mean ID 82-85?
        // showing all for safety but condensed.
        console.log(`[${i + 1}] ID:${s.id} Name:${s.nome} ${s.cognome} Role:${s.ruolo} Postazioni:${JSON.stringify(s.postazioni)}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
