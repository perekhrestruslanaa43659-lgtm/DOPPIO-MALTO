import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendVerificationSuccessEmail } from '@/lib/email';

export async function POST(request: Request) {
    try {
        const { token } = await request.json();

        if (!token) {
            return NextResponse.json({ error: 'Token mancante' }, { status: 400 });
        }

        const user = await prisma.user.findFirst({
            where: { verificationToken: token }
        });

        if (!user) {
            return NextResponse.json({ error: 'Token non valido.' }, { status: 400 });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                isVerified: true,
                verificationToken: null // One-time use
            }
        });

        // Send confirmation email (non-blocking - don't fail if email fails)
        sendVerificationSuccessEmail(user.email, user.name || '', user.tenantKey).catch(err => {
            console.error('Failed to send verification success email:', err);
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Verification error:', error);
        return NextResponse.json({ error: 'Errore interno.' }, { status: 500 });
    }
}
