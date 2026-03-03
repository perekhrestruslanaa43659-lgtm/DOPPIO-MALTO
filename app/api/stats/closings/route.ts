import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { differenceInMinutes, parse, isBefore, isAfter, addDays } from 'date-fns';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const start = searchParams.get('start');
        const end = searchParams.get('end');
        const tenantKey = searchParams.get('tenantKey') || 'default-tenant'; // Ideally gets from auth context

        if (!start || !end) {
            return NextResponse.json({ error: 'Missing dates' }, { status: 400 });
        }

        const assignments = await prisma.assignment.findMany({
            where: {
                tenantKey,
                data: {
                    gte: start,
                    lte: end
                }
            },
            include: {
                staff: true
            }
        });

        console.log(`[API Closings] Found ${assignments.length} assignments for range ${start} to ${end}`);
        if (assignments.length > 0) {
            console.log(`[API Closings] Sample Assignment:`, assignments[0]);
        }

        const CUCINA_KEYWORDS = ['FRITTI', 'DOLCI', 'PREPARAZIONE', 'LAVAGGIO', 'GRIGLIA', 'CUCINA', 'PIRA', 'BURGER', 'PLONGE', 'CUOCO', 'CHEF', 'PIZZAIOLO', 'AIUTO', 'LAVAPIATTI'];
        const SALA_KEYWORDS = ['SALA', 'CAMERIERE', 'BAR', 'RUNNER', 'RESPONSABILE', 'DIRETTORE', 'ACCOGLIENZA', 'HOSTESS', 'CASSA'];

        const getCategory = (station: string | null, role: string) => {
            const s = (station || role || '').toUpperCase();
            if (CUCINA_KEYWORDS.some(k => s.includes(k))) return 'CUCINA';
            if (SALA_KEYWORDS.some(k => s.includes(k))) return 'SALA';
            if (s.includes('JOLLY')) return 'CUCINA'; // Jolly usually Kitchen or General
            return 'SALA'; // Default fallback
        };

        const result: Record<string, any> = {};

        assignments.forEach(a => {
            if (!a.start_time || !a.end_time) return;

            const date = a.data;
            if (!result[date]) {
                result[date] = {
                    lunch: { sala: 0, cucina: 0 },
                    dinner: { sala: 0, cucina: 0 }
                };
            }

            const cat = getCategory(a.postazione, a.staff.ruolo);

            // Logic to calculate hours and split Lunch/Dinner
            // Lunch: < 16:00
            // Dinner: >= 16:00

            // Convert times to comparable minutes or date objects
            const parseTime = (t: string) => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            };

            const startMins = parseTime(a.start_time);
            const endMins = parseTime(a.end_time);

            // Handle overnight shifts? Assuming shifts fit within "Operational Day" logic or ignoring for simple MVP
            // If end < start, assume next day? Not common for lunch/dinner split logic here usually.
            // Let's assume standard day shifts for now.

            const splitMins = 16 * 60; // 16:00

            // Lunch Segment
            if (startMins < splitMins) {
                const lEnd = Math.min(endMins, splitMins);
                const dur = Math.max(0, lEnd - startMins) / 60;
                if (cat === 'SALA') result[date].lunch.sala += dur;
                else result[date].lunch.cucina += dur;
            }

            // Dinner Segment
            if (endMins > splitMins) {
                const dStart = Math.max(startMins, splitMins);
                const dur = Math.max(0, endMins - dStart) / 60;
                if (cat === 'SALA') result[date].dinner.sala += dur;
                else result[date].dinner.cucina += dur;
            }
        });

        // Format for easy consumption: Array of 7 days
        // We need to return an object keyed by date string
        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Stats Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
