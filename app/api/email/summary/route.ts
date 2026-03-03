import { NextRequest, NextResponse } from 'next/server';
import { sendClosingSummaryEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

export async function POST(req: NextRequest) {
    try {
        // 1. Auth Check
        const token = cookies().get('token')?.value;
        if (!token) {
            return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
        }

        const decoded: any = jwt.verify(token, JWT_SECRET);
        if (!decoded || !decoded.userId) {
            return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
        }

        // 2. Get User & Tenant
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) {
            return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
        }

        // 3. Parse Body
        const body = await req.json();
        const { recipient, data } = body;

        if (!recipient || !data) {
            return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 });
        }

        // 4. Send Email
        const result = await sendClosingSummaryEmail(recipient, data, user.tenantKey);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
