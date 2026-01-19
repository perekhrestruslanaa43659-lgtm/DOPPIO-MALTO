-- Create ForecastRow table
CREATE TABLE IF NOT EXISTS "ForecastRow" (
    "id" SERIAL PRIMARY KEY,
    "weekStart" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Create Budget table  
CREATE TABLE IF NOT EXISTS "Budget" (
    "id" SERIAL PRIMARY KEY,
    "data" TEXT NOT NULL UNIQUE,
    "value" DOUBLE PRECISION DEFAULT 0,
    "hoursLunch" DOUBLE PRECISION DEFAULT 0,
    "hoursDinner" DOUBLE PRECISION DEFAULT 0,
    "valueLunch" DOUBLE PRECISION DEFAULT 0,
    "valueDinner" DOUBLE PRECISION DEFAULT 0
);
-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "ForecastRow_weekStart_idx" ON "ForecastRow"("weekStart");
CREATE INDEX IF NOT EXISTS "Budget_data_idx" ON "Budget"("data");