
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
    const targetDate = '2026-02-08'; // Sunday
    const output = [];

    output.push(`🔍 Inspecting data for Sunday: ${targetDate}`);

    try {
        // Check Shifts
        const shifts = await prisma.shift.findMany({
            where: {
                date: targetDate
            }
        });
        output.push(`\n📅 Shifts found: ${shifts.length}`);
        if (shifts.length > 0) {
            output.push(shifts.map(s => `${s.staffId} | ${s.startTime}-${s.endTime}`).join('\n'));
        }

        // Check Requirements (Coverage)
        const reqs = await prisma.dailyRequirement.findMany({
            where: {
                date: targetDate
            }
        });
        output.push(`\n📊 Requirements found: ${reqs.length}`);
        if (reqs.length > 0) {
            output.push(reqs.map(r => `${r.role}: ${r.qty} required`).join('\n'));
        }

        // Check ShiftTemplates for Sunday
        const templates = await prisma.shiftTemplate.findMany();
        const sundayTemplates = templates.filter(t => {
            try {
                if (!t.giorniValidi) return false;
                const days = JSON.parse(t.giorniValidi);
                return Array.isArray(days) && days.includes(0); // 0 is Sunday
            } catch (e) {
                output.push(`⚠️ Error parsing template ${t.id}: ${e.message}`);
                return false;
            }
        });
        output.push(`\n📋 Templates active on Sunday: ${sundayTemplates.length}`);
        sundayTemplates.forEach(t => output.push(`- ${t.nome}`));

    } catch (e) {
        output.push(`❌ Error: ${e.message}`);
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }

    fs.writeFileSync('inspection_output.txt', output.join('\n'));
    console.log('Output written to inspection_output.txt');
}

main();
