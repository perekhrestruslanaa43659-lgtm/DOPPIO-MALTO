
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listUsers() {
    try {
        console.log("--- LISTING USERS ---");
        const users = await prisma.user.findMany();
        users.forEach(u => console.log(`[USER] ${u.email} (ID: ${u.id})`));

        console.log("--- LISTING STAFF ---");
        const staff = await prisma.staff.findMany();
        staff.forEach(s => console.log(`[STAFF] ${s.email} (Nome: ${s.nome} ${s.cognome})`));

    } catch (e: any) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

listUsers();
