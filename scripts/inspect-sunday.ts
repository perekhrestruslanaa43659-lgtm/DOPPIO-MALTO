
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    const targetDate = '2026-02-08'; // Sunday
    const output: string[] = [];

    output.push(`🔍 Inspecting data for Sunday: ${targetDate}`);

    // Debug available models
    // @ts-ignore
    const modelNames = Object.keys(prisma).filter(key => key[0] !== '_' && key[0] !== '$');
    output.push(`available models: ${modelNames.join(', ')}`);

    try {
        // Check Shifts (Assignments)
        const shifts = await prisma.assignment.findMany({
            where: {
                data: targetDate // Assignment uses 'data' field for date string
            }
        });
        output.push(`\n📅 Assignments (Shifts) found: ${shifts.length}`);
        if (shifts.length > 0) {
            output.push(shifts.map((s: any) => `${s.staffId} | ${s.start_time}-${s.end_time}`).join('\n'));
        }

        // Check CoverageRow (Requirements)
        // Sunday 2026-02-08 is part of week starting Monday 2026-02-02
        const weekStart = '2026-02-02';

        const reqs = await prisma.coverageRow.findMany({
            where: {
                weekStart: weekStart
            }
        });
        output.push(`\n📊 CoverageRows for week ${weekStart}: ${reqs.length}`);
        if (reqs.length > 0) {
            reqs.forEach((r: any) => {
                output.push(`- Station: ${r.station}`);
                output.push(`  Slots: ${r.slots}`);
            });
        } else {
            // Check ANY coverage row to see format
            const metadata = await prisma.coverageRow.findFirst();
            if (metadata) {
                output.push(`\n(Sample existing CoverageRow weekStart: ${metadata.weekStart})`);
            }
        }

        // Check ShiftTemplates for Sunday
        const templates = await prisma.shiftTemplate.findMany();
        const sundayTemplates = templates.filter((t: any) => {
            try {
                if (!t.giorniValidi) return false;
                const days = JSON.parse(t.giorniValidi);
                return Array.isArray(days) && days.includes(0); // 0 is Sunday
            } catch (e: any) {
                output.push(`⚠️ Error parsing template ${t.id}: ${e.message}`);
                return false;
            }
        });
        output.push(`\n📋 Templates active on Sunday: ${sundayTemplates.length}`);
        sundayTemplates.forEach((t: any) => output.push(`- ${t.nome}`));

    } catch (e: any) {
        output.push(`❌ Error: ${e.message}`);
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }

    fs.writeFileSync('inspection_output.txt', output.join('\n'));
    console.log('Output written to inspection_output.txt');
}

main();
