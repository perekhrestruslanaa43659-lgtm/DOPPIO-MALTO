const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Checking for missing columns in Unavailability table...");

        // Add columns if they don't exist
        await prisma.$executeRawUnsafe(`
      ALTER TABLE "Unavailability" 
      ADD COLUMN IF NOT EXISTS "reason" TEXT,
      ADD COLUMN IF NOT EXISTS "start_time" TEXT,
      ADD COLUMN IF NOT EXISTS "end_time" TEXT;
    `);

        console.log("Success: Columns 'reason', 'start_time', 'end_time' added to Unavailability.");
    } catch (e) {
        console.error("Error updating schema:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
