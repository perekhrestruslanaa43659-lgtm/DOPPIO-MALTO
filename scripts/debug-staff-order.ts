
import { PrismaClient } from '@prisma/client';

const prismadb = new PrismaClient();

async function main() {
    try {
        const staff = await prismadb.staff.findMany({
            orderBy: { listIndex: 'asc' }
        });

        console.log("--- STAFF ORDER ---");
        console.log("ID | Name | Role | ListIndex");
        staff.forEach(s => {
            console.log(`${s.id} | ${s.nome} ${s.cognome} | ${s.ruolo} | ${s.listIndex}`);
        });

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
