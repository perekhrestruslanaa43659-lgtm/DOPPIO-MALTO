const fs = require('fs');
const path = require('path');

try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf8').split('\n');
        for (const line of lines) {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
                if (key && !process.env[key]) {
                    process.env[key] = val;
                }
            }
        }
    }
} catch (e) { console.log('Env load failed', e); }

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.staff.findMany();
    console.log(`Checking ${users.length} users for duplicates...`);

    // Check Email Duplicates
    const emailCounts = {};
    users.forEach(u => {
        if (u.email) {
            emailCounts[u.email] = (emailCounts[u.email] || 0) + 1;
        }
    });

    const duplicateEmails = Object.keys(emailCounts).filter(e => emailCounts[e] > 1);

    if (duplicateEmails.length > 0) {
        console.log('🔥 DUPLICATE EMAILS FOUND:');
        duplicateEmails.forEach(e => {
            console.log(`Email: ${e}`);
            const matches = users.filter(u => u.email === e);
            matches.forEach(m => console.log(`  - ID ${m.id}: ${m.nome} ${m.cognome}`));
        });
    } else {
        console.log('✅ No email duplicates found.');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
