const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Testing Simple Create...");
    try {
        const staff = await prisma.staff.create({
            data: {
                nome: "TEST_USER",
                cognome: "TEST_SURNAME",
                ruolo: "STAFF",
                postazioni: "BAR", // Simple string
                email: "test@example.com"
            }
        });
        console.log("Created:", staff);
    } catch (e) {
        console.error("Error CAUGHT:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
