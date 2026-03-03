-- CreateTable: StaffCompetency
-- Run this in your Neon DB SQL console if prisma db push fails from terminal
CREATE TABLE IF NOT EXISTS "StaffCompetency" (
    "id" SERIAL PRIMARY KEY,
    "staffId" INTEGER NOT NULL,
    "postazione" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 3,
    "note" TEXT NOT NULL DEFAULT '',
    "tenantKey" TEXT NOT NULL DEFAULT 'default-tenant',
    CONSTRAINT "StaffCompetency_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "StaffCompetency_staffId_postazione_key" ON "StaffCompetency"("staffId", "postazione");
CREATE INDEX IF NOT EXISTS "StaffCompetency_tenantKey_idx" ON "StaffCompetency"("tenantKey");
CREATE INDEX IF NOT EXISTS "StaffCompetency_staffId_idx" ON "StaffCompetency"("staffId");