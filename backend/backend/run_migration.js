const { execSync } = require('child_process');
require('dotenv').config();

console.log("Pushing schema changes with data loss acceptance...");
try {
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit', env: process.env });
} catch (error) {
    console.error("Migration failed:", error.message);
    process.exit(1);
}
