-- CreateTable
CREATE TABLE "Staff" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "cognome" TEXT NOT NULL DEFAULT '',
    "ruolo" TEXT NOT NULL,
    "email" TEXT,
    "oreMinime" INTEGER NOT NULL DEFAULT 0,
    "oreMassime" INTEGER NOT NULL DEFAULT 40,
    "costoOra" REAL NOT NULL DEFAULT 0,
    "listIndex" INTEGER NOT NULL,
    "fixedShifts" TEXT DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moltiplicatore" REAL NOT NULL DEFAULT 1.0,
    "postazioni" TEXT NOT NULL DEFAULT '[]',
    "tenantKey" TEXT NOT NULL DEFAULT 'default-tenant',
    "skillLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "incompatibilityId" TEXT
);

-- CreateTable
CREATE TABLE "ShiftTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "oraInizio" TEXT NOT NULL,
    "oraFine" TEXT NOT NULL,
    "ruoloRichiesto" TEXT NOT NULL,
    "giorniValidi" TEXT NOT NULL DEFAULT '',
    "tenantKey" TEXT NOT NULL DEFAULT 'default-tenant'
);

-- CreateTable
CREATE TABLE "Unavailability" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "staffId" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "reason" TEXT,
    "start_time" TEXT,
    "end_time" TEXT,
    "tenantKey" TEXT NOT NULL DEFAULT 'default-tenant',
    CONSTRAINT "Unavailability_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Constraint" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipo" TEXT NOT NULL,
    "valore" TEXT NOT NULL,
    "tenantKey" TEXT NOT NULL DEFAULT 'default-tenant'
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "data" TEXT NOT NULL,
    "staffId" INTEGER NOT NULL,
    "shiftTemplateId" INTEGER,
    "start_time" TEXT,
    "end_time" TEXT,
    "status" BOOLEAN NOT NULL DEFAULT false,
    "postazione" TEXT,
    "tenantKey" TEXT NOT NULL DEFAULT 'default-tenant',
    CONSTRAINT "Assignment_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "ShiftTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Assignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "data" TEXT NOT NULL,
    "value" REAL NOT NULL DEFAULT 0,
    "hoursLunch" REAL NOT NULL DEFAULT 0,
    "hoursDinner" REAL NOT NULL DEFAULT 0,
    "valueLunch" REAL NOT NULL DEFAULT 0,
    "valueDinner" REAL NOT NULL DEFAULT 0,
    "tenantKey" TEXT NOT NULL DEFAULT 'default-tenant'
);

-- CreateTable
CREATE TABLE "CoverageRow" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "weekStart" TEXT NOT NULL,
    "station" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "slots" TEXT NOT NULL DEFAULT '{}',
    "extra" TEXT NOT NULL DEFAULT '{}',
    "tenantKey" TEXT NOT NULL DEFAULT 'default-tenant'
);

-- CreateTable
CREATE TABLE "ForecastRow" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "weekStart" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantKey" TEXT NOT NULL DEFAULT 'default-tenant'
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "surname" TEXT,
    "dob" TEXT,
    "address" TEXT,
    "role" TEXT NOT NULL DEFAULT 'OWNER',
    "tenantKey" TEXT NOT NULL DEFAULT 'default-tenant',
    "companyName" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUser" TEXT,
    "smtpPassword" TEXT
);

-- CreateTable
CREATE TABLE "RecurringShift" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "staffId" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "shiftTemplateId" INTEGER,
    "postazione" TEXT,
    "startWeek" INTEGER,
    "endWeek" INTEGER,
    "startYear" INTEGER,
    "endYear" INTEGER,
    "tenantKey" TEXT NOT NULL DEFAULT 'default-tenant',
    CONSTRAINT "RecurringShift_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "ShiftTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RecurringShift_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PermissionRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "staffId" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "endDate" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "tipo" TEXT NOT NULL,
    "motivo" TEXT,
    "dettagli" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminResponse" TEXT,
    "processedAt" DATETIME,
    "processedBy" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PermissionRequest_processedBy_fkey" FOREIGN KEY ("processedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PermissionRequest_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Staff_tenantKey_idx" ON "Staff"("tenantKey");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_email_tenantKey_key" ON "Staff"("email", "tenantKey");

-- CreateIndex
CREATE INDEX "ShiftTemplate_tenantKey_idx" ON "ShiftTemplate"("tenantKey");

-- CreateIndex
CREATE INDEX "Unavailability_tenantKey_idx" ON "Unavailability"("tenantKey");

-- CreateIndex
CREATE INDEX "Constraint_tenantKey_idx" ON "Constraint"("tenantKey");

-- CreateIndex
CREATE INDEX "Assignment_tenantKey_idx" ON "Assignment"("tenantKey");

-- CreateIndex
CREATE INDEX "Budget_tenantKey_idx" ON "Budget"("tenantKey");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_data_tenantKey_key" ON "Budget"("data", "tenantKey");

-- CreateIndex
CREATE INDEX "CoverageRow_tenantKey_idx" ON "CoverageRow"("tenantKey");

-- CreateIndex
CREATE INDEX "ForecastRow_tenantKey_idx" ON "ForecastRow"("tenantKey");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantKey_idx" ON "User"("tenantKey");

-- CreateIndex
CREATE INDEX "RecurringShift_tenantKey_idx" ON "RecurringShift"("tenantKey");
