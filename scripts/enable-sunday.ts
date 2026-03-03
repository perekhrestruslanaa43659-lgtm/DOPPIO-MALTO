
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔧 Enabling Sunday for Shift Templates...');

    const templates = await prisma.shiftTemplate.findMany();
    console.log(`Found ${templates.length} templates.`);

    let updatedCount = 0;

    for (const t of templates) {
        let days: number[] = [];
        try {
            days = JSON.parse(t.giorniValidi || '[]');
        } catch (e) {
            console.error(`Error parsing template ${t.id}:`, e);
            continue;
        }

        if (!Array.isArray(days)) days = [];

        // Check if Sunday (0) is present
        if (!days.includes(0)) {
            console.log(`Adding Sunday to template: ${t.nome}`);
            days.push(0);

            await prisma.shiftTemplate.update({
                where: { id: t.id },
                data: {
                    giorniValidi: JSON.stringify(days)
                }
            });
            updatedCount++;
        }
    }

    console.log(`✅ Updated ${updatedCount} templates to include Sunday.`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
