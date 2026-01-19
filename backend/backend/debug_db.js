const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        await prisma.$connect();
        console.log("Connected to DB!");
        const staff = await prisma.staff.count();
        console.log("Staff count:", staff);
        try {
            const users = await prisma.user.count();
            console.log("User count:", users);
        } catch (e) {
            console.log("User table query failed:", e.code);
        }
    } catch (e) {
        console.error("Connection failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
