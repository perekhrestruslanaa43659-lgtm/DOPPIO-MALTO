import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ error: 'Email richiesta' }, { status: 400 });
        }

        const user = await prisma.user.findFirst({
            where: {
                email: {
                    equals: email,
                    mode: 'insensitive' // Ensure case-insensitive match
                }
            }
        });

        if (!user) {
            // Return success even if user not found to prevent enumeration
            return NextResponse.json({ success: true, message: 'Se l\'email esiste, riceverai un link di reset.' });
        }

        // Generate Token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

        // Save to DB
        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetToken,
                resetTokenExpiry
            }
        });

        // Send Email
        const result = await sendPasswordResetEmail(user.email, resetToken, user.tenantKey);

        if (!result.success) {
            console.error('Failed to send reset email:', result.error);
            return NextResponse.json({ error: 'Errore invio email' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Email di reset inviata.' });

    } catch (error: any) {
        console.error('Forgot Password Error:', error);
        return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
    }
}
