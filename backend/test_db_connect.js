const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Connecting...");
    try {
        await prisma.$connect();
        console.log("Connected successfully!");
        const count = await prisma.staff.count();
        console.log("Staff count:", count);
    } catch (e) {
        console.error("Connection failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
