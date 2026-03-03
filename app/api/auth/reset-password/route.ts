import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';

export async function POST(req: NextRequest) {
    try {
        const { token, password } = await req.json();

        if (!token || !password) {
            return NextResponse.json({ error: 'Token e password richiesti' }, { status: 400 });
        }

        // Find user by token and check expiry
        const user = await prisma.user.findFirst({
            where: {
                resetToken: token,
                resetTokenExpiry: {
                    gt: new Date() // Expiry must be in the future
                }
            }
        });

        if (!user) {
            return NextResponse.json({ error: 'Token non valido o scaduto' }, { status: 400 });
        }

        // Hash new password
        const hashedPassword = await hashPassword(password);

        // Update User
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetToken: null,
                resetTokenExpiry: null
            }
        });

        return NextResponse.json({ success: true, message: 'Password aggiornata con successo' });

    } catch (error: any) {
        console.error('Reset Password Error:', error);
        return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
    }
}
