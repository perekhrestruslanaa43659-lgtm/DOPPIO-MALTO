
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const tenantKey = "145-p772b4z87";
    const start = "2026-02-02";
    const end = "2026-02-08";

    const assignments = await prisma.assignment.findMany({
        where: {
            tenantKey,
            data: {
                gte: start,
                lte: end
            }
        },
        include: {
            staff: {
                select: { nome: true, cognome: true }
            }
        }
    });

    console.log(`Found ${assignments.length} assignments for ${tenantKey} between ${start} and ${end}`);
    if (assignments.length > 0) {
        console.log(JSON.stringify(assignments.map(a => ({
            id: a.id,
            date: a.data,
            staff: `${a.staff.nome} ${a.staff.cognome}`,
            start: a.start_time,
            end: a.end_time,
            station: a.postazione
        })), null, 2));
    }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
