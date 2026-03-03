const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    // Check Staff postazioni JSON fields
    const staff = await prisma.staff.findMany({ select: { nome: true, cognome: true, postazioni: true } });
    staff.forEach(s => {
        const posts = s.postazioni ? JSON.parse(s.postazioni) : [];
        const hasJoly = posts.some(p => p.toLowerCase().includes('jol'));
        if (hasJoly) console.log(`${s.nome} ${s.cognome}:`, posts);
    });
    console.log('Done scanning staff postazioni');

    // Also check ShiftEditorModal or similar hardcoded lists
    console.log('\nAll distinct postazioni in StaffCompetency:');
    const comps = await prisma.staffCompetency.findMany({ select: { postazione: true }, distinct: ['postazione'] });
    console.log(comps.map(c => c.postazione).join(', '));
}
main().finally(() => prisma.$disconnect());
