
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const users = await prisma.user.findMany({ select: { email: true, role: true, tenantKey: true } });
        const staff = await prisma.staff.findMany({ select: { nome: true, cognome: true, tenantKey: true } });

        return NextResponse.json({
            users,
            staff,
            userCount: users.length,
            staffCount: staff.length
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
