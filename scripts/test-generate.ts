
import { PrismaClient } from '@prisma/client';
import { generateSmartSchedule } from '../lib/scheduler';
import { addDays, startOfWeek, endOfWeek, format } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Testing Scheduler Generation ---');

    // 1. Get Ruslana and Tenant
    const ruslana = await prisma.staff.findFirst({
        where: { nome: { contains: 'Ruslana', mode: 'insensitive' } }
    });

    if (!ruslana) {
        console.log('Ruslana not found');
        return;
    }

    const tenantKey = ruslana.tenantKey;
    console.log(`Target Tenant: ${tenantKey}`);

    // 2. Define Date Range (Current Week)
    const today = new Date();
    // Assuming user is talking about 'next week' or 'this week'. Let's pick a Monday-Sunday range covering today or next week.
    // If today is Sunday, maybe next week.
    const start = startOfWeek(today, { weekStartsOn: 1 });
    const end = endOfWeek(today, { weekStartsOn: 1 });

    const sStr = format(start, 'yyyy-MM-dd');
    const eStr = format(end, 'yyyy-MM-dd');

    console.log(`Generating for ${sStr} to ${eStr}...`);

    // 3. Run Generator
    // This will trigger the console.logs inside scheduler.ts
    const result = await generateSmartSchedule(sStr, eStr, tenantKey);

    console.log(`Generation Complete. Assignments: ${result.assignmentCount}, Unassigned: ${result.unassigned.length}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
