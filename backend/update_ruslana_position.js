const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateRuslanaPosition() {
    try {
        // Get Ruslana's current data
        const ruslana = await prisma.staff.findFirst({
            where: { id: 50 }
        });

        console.log('Current Ruslana data:');
        console.log(`  listIndex: ${ruslana.listIndex}`);
        console.log(`  Nome: ${ruslana.nome} ${ruslana.cognome}`);

        // Update listIndex to 5 (to appear near the top)
        const updated = await prisma.staff.update({
            where: { id: 50 },
            data: { listIndex: 5 }
        });

        console.log('\n✅ Updated Ruslana listIndex to 5');
        console.log('Ruslana should now appear in the staff list!');

        // Show all staff with their listIndex
        console.log('\nCurrent staff order:');
        const allStaff = await prisma.staff.findMany({
            orderBy: { listIndex: 'asc' },
            select: { id: true, nome: true, cognome: true, listIndex: true }
        });

        allStaff.slice(0, 15).forEach((s, i) => {
            const highlight = s.id === 50 ? ' ← RUSLANA' : '';
            console.log(`${i + 1}. ${s.nome} ${s.cognome || ''} (listIndex: ${s.listIndex})${highlight}`);
        });

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

updateRuslanaPosition();
