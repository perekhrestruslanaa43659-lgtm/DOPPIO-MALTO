const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Connecting...");
    try {
        await prisma.$connect();
        console.log("Connected successfully!");

        // Exact query from server.js (FIXED)
        console.log("Running FindMany...");
        const staff = await prisma.staff.findMany({
            include: { unavailabilities: true }
            // orderBy removed
        });
        console.log("FindMany success. Count:", staff.length);

        // Exact processing from server.js
        console.log("Processing Data...");
        const clean = staff.map(s => ({
            ...s,
            postazioni: (s.postazioni && typeof s.postazioni === 'string' && s.postazioni.trim())
                ? s.postazioni.split(',').map(p => p.trim()).filter(p => p)
                : [],
            fixedShifts: s.fixedShifts && typeof s.fixedShifts === 'string' ? JSON.parse(s.fixedShifts) : (s.fixedShifts || {})
        }));
        console.log("Processing success!");

    } catch (e) {
        console.error("CRASH REPRODUCED:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
