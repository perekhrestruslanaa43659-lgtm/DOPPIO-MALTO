import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendVerificationEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(request: Request) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json({ error: 'Email mancante' }, { status: 400 });
        }

        const user = await prisma.user.findFirst({
            where: {
                email: {
                    equals: email,
                    mode: 'insensitive'
                }
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
        }

        if (user.isVerified) {
            return NextResponse.json({ error: 'Utente già verificato' }, { status: 400 });
        }

        // Generate new token or reuse? Let's generate a new one to be safe/fresh.
        const verificationToken = crypto.randomBytes(32).toString('hex');

        await prisma.user.update({
            where: { id: user.id },
            data: { verificationToken }
        });

        const emailRes = await sendVerificationEmail(
            user.email,
            verificationToken,
            user.tenantKey,
            user.name || '',
            `${new URL(request.url).protocol}//${new URL(request.url).host}`
        );

        if (!emailRes.success) {
            return NextResponse.json({ error: 'Errore invio email: ' + emailRes.error }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Resend verification error:', error);
        console.error('Error details:', {
            message: error?.message,
            stack: error?.stack,
            name: error?.name
        });
        return NextResponse.json({
            error: 'Errore interno: ' + (error?.message || 'Unknown error')
        }, { status: 500 });
    }
}
