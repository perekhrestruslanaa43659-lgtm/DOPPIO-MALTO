
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUser(email: string) {
    try {
        console.log(`Checking email: ${email}`);

        let user = null;
        try {
            user = await prisma.user.findFirst({
                where: { email: email }
            });
        } catch (e) { console.log("User table search failed or likely unique constraint diff"); }

        if (user) {
            console.log(`FOUND USER: ${user.name} (ID: ${user.id}, Role: ${user.role})`);
        } else {
            console.log("User NOT FOUND in 'User' table.");
        }

        let staff = null;
        try {
            staff = await prisma.staff.findFirst({
                where: { email: email }
            });
        } catch (e) { console.log("Staff table search failed"); }

        if (staff) {
            console.log(`FOUND STAFF: ${staff.nome} ${staff.cognome} (ID: ${staff.id}, Role: ${staff.ruolo})`);
        } else {
            console.log("Staff NOT FOUND in 'Staff' table.");
        }

    } catch (e: any) {
        console.error("General Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

checkUser('rusliperekhres@gmail.com');
