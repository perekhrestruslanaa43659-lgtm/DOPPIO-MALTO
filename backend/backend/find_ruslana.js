const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findRuslana() {
    try {
        const staff = await prisma.staff.findMany({
            where: {
                OR: [
                    { nome: { contains: 'Ruslana', mode: 'insensitive' } },
                    { cognome: { contains: 'Ruslana', mode: 'insensitive' } }
                ]
            }
        });

        console.log('Found staff members:', JSON.stringify(staff, null, 2));

        if (staff.length === 0) {
            console.log('\nRuslana NOT found in database');
            console.log('\nLet me check all staff members:');
            const allStaff = await prisma.staff.findMany({
                orderBy: { listIndex: 'asc' }
            });
            console.log(`Total staff members: ${allStaff.length}`);
            allStaff.forEach((s, i) => {
                console.log(`${i + 1}. ${s.nome} ${s.cognome || ''} (ID: ${s.id})`);
            });
        }
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

findRuslana();
