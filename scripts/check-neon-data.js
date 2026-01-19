const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
    console.log('=== VERIFICA DATI DATABASE NEON ===\n');

    try {
        // Check Users
        const users = await prisma.user.findMany();
        console.log(`👥 Utenti trovati: ${users.length}`);
        if (users.length > 0) {
            users.forEach(u => console.log(`   - ${u.email} (${u.role}, tenant: ${u.tenantKey})`));
        }

        // Check Staff
        const staff = await prisma.staff.findMany();
        console.log(`\n👤 Staff trovati: ${staff.length}`);
        if (staff.length > 0) {
            staff.slice(0, 5).forEach(s => console.log(`   - ${s.nome} ${s.cognome} (${s.ruolo}, tenant: ${s.tenantKey})`));
            if (staff.length > 5) console.log(`   ... e altri ${staff.length - 5}`);
        }

        // Check Forecast
        const forecast = await prisma.forecastRow.findMany();
        console.log(`\n📊 Forecast trovati: ${forecast.length}`);
        if (forecast.length > 0) {
            forecast.slice(0, 3).forEach(f => console.log(`   - Week ${f.weekStart} (tenant: ${f.tenantKey})`));
        }

        // Check Assignments
        const assignments = await prisma.assignment.findMany();
        console.log(`\n📅 Assignments trovati: ${assignments.length}`);

        // List all tenants
        const tenants = [...new Set([
            ...users.map(u => u.tenantKey),
            ...staff.map(s => s.tenantKey)
        ])];
        console.log(`\n🏢 Tenant keys presenti: ${tenants.join(', ')}`);

    } catch (error) {
        console.error('❌ Errore:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkData();
