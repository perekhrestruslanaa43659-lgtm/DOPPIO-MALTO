
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("🔍 Verifying Data for Week 8 (2026-02-16 to 2026-02-22)...");

    const count = await prisma.assignment.count({
        where: {
            data: {
                gte: '2026-02-16',
                lte: '2026-02-22'
            }
        }
    });

    console.log(`📊 Found ${count} assignments.`);

    if (count > 0) {
        const samples = await prisma.assignment.findMany({
            where: {
                data: {
                    gte: '2026-02-16',
                    lte: '2026-02-22'
                }
            },
            select: {
                id: true,
                data: true,
                start_time: true,
                end_time: true,
                note: true,
                tenantKey: true,
                staff: {
                    select: {
                        id: true,
                        nome: true,
                        cognome: true,
                        tenantKey: true
                    }
                }
            }
        });
        console.log("📝 Sample Assignments:");
        console.log(JSON.stringify(samples, null, 2));
    } else {
        console.log("⚠️ No assignments found. Checking ANY assignments to verify date format...");
        const any = await prisma.assignment.findFirst();
        if (any) {
            console.log("Example existing assignment:", any);
        } else {
            console.log("Database is completely empty of assignments.");
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
