const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Creating User table via raw SQL...");
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "User" (
                "id" SERIAL NOT NULL,
                "email" TEXT NOT NULL,
                "password" TEXT NOT NULL,
                "name" TEXT,
                "role" TEXT NOT NULL DEFAULT 'USER',

                CONSTRAINT "User_pkey" PRIMARY KEY ("id")
            );
        `);
        console.log("Table created (or exists).");

        await prisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
        `);
        console.log("Index created.");

    } catch (e) {
        console.error("Error creating table:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
