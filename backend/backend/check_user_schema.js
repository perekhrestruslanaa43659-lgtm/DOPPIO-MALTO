const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Checking User table...");
        // Try to fetch one user and see what fields come back (even if it fails, error message might help)
        const user = await prisma.user.findFirst();
        console.log("User sample:", user);
    } catch (e) {
        console.error("Error fetching user:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
