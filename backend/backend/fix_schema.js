const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Attempting manual schema fix...");

        // 1. Add missing columns to User table
        console.log("Adding columns to User table...");
        try {
            await prisma.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "surname" TEXT;`;
            await prisma.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dob" TEXT;`;
            await prisma.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "address" TEXT;`;
            console.log("User table columns added/verified.");
        } catch (e) {
            console.error("Error updating User table:", e.message);
        }

        // 2. Create RecurringShift table if it doesn't exist
        console.log("Creating RecurringShift table...");
        try {
            await prisma.$executeRaw`
            CREATE TABLE IF NOT EXISTS "RecurringShift" (
                "id" SERIAL PRIMARY KEY,
                "staffId" INTEGER NOT NULL,
                "dayOfWeek" INTEGER NOT NULL,
                "start_time" TEXT,
                "end_time" TEXT,
                "shiftTemplateId" INTEGER,
                "postazione" TEXT,
                CONSTRAINT "RecurringShift_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE,
                CONSTRAINT "RecurringShift_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "ShiftTemplate"("id") ON DELETE SET NULL
            );
        `;
            console.log("RecurringShift table created/verified.");
        } catch (e) {
            console.error("Error creating RecurringShift table:", e.message);
        }

        // 3. Add 'postazione', 'start_time', 'end_time', 'status' to Assignment if missing
        console.log("Adding columns to Assignment table...");
        try {
            await prisma.$executeRaw`ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "postazione" TEXT;`;
            await prisma.$executeRaw`ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "start_time" TEXT;`;
            await prisma.$executeRaw`ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "end_time" TEXT;`;
            try {
                await prisma.$executeRaw`ALTER TABLE "Assignment" ADD COLUMN "status" BOOLEAN DEFAULT FALSE;`;
            } catch (ee) {
                // Might already exist or fail if boolean cast issue, using IF NOT EXISTS logic if possible
                // Postgres 9.6+ supports IF NOT EXISTS for ADD COLUMN but BOOLEAN DEFAULT FALSE is tricky if already there
                // Just catch error
            }
            console.log("Assignment table updated.");
        } catch (e) {
            console.error("Error updating Assignment table:", e.message);
        }

        console.log("Manual schema fix complete.");
    } catch (e) {
        console.error("Global error in fix script:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
