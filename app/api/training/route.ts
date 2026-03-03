
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');
        if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

        const body = await request.json();
        const { weekStart, data, rating, source } = body;

        if (!weekStart || !data) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Weighting Logic
        let finalRating = rating || 5;
        if (source === 'CORRECTION') {
            finalRating = 10; // Double weight for manual corrections
        } else if (source === 'IMPORT') {
            finalRating = 5; // Standard weight for historical
        }

        // Check if training data for this week already exists, if so update/replace or create new?
        // User might retrain multiple times. Let's create new entries for history?
        // Or upsert to avoid duplicate data for same week?
        // Decision: Create new entry to build dataset of "good versions".

        const trainingData = await prisma.trainingData.create({
            data: {
                weekStart,
                data: JSON.stringify(data),
                rating: finalRating,
                source: source || 'MANUAL',
                tenantKey
            }
        });

        return NextResponse.json({ success: true, id: trainingData.id });
    } catch (error: any) {
        console.error('Error saving training data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');
        if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

        const data = await prisma.trainingData.findMany({
            where: { tenantKey },
            orderBy: { date: 'desc' },
            take: 50 // Limit to recent history
        });

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Error fetching training data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
