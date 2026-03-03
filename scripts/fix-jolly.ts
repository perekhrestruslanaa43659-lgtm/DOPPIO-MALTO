import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    // Fix StaffCompetency
    const sc = await prisma.staffCompetency.updateMany({
        where: { postazione: { equals: 'Joly', mode: 'insensitive' } },
        data: { postazione: 'Jolly' }
    });
    console.log('StaffCompetency updated:', sc.count);

    // Fix ShiftTemplate
    const st = await prisma.shiftTemplate.updateMany({
        where: { postazione: { equals: 'Joly', mode: 'insensitive' } },
        data: { postazione: 'Jolly' }
    });
    console.log('ShiftTemplate updated:', st.count);

    // Fix Assignment
    const as = await prisma.assignment.updateMany({
        where: { postazione: { equals: 'Joly', mode: 'insensitive' } },
        data: { postazione: 'Jolly' }
    });
    console.log('Assignment updated:', as.count);

    console.log('✅ Done!');
}
main().catch(console.error).finally(() => prisma.$disconnect());
