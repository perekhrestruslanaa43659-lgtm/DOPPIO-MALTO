import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const userEmail = request.headers.get('x-user-email');
        if (!userEmail) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: 'Tutti i campi sono obbligatori' }, { status: 400 });
        }

        if (newPassword.length < 6) {
            return NextResponse.json({ error: 'La nuova password deve essere di almeno 6 caratteri' }, { status: 400 });
        }

        // Fetch user with password
        const user = await prisma.user.findUnique({
            where: { email: userEmail }
        });

        if (!user) {
            return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
        }

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
            // Check if it's the raw initial password (rare case if not hashed yet, but we usually hash on create)
            // Safety check:
            return NextResponse.json({ error: 'Password attuale non corretta' }, { status: 400 });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update
        await prisma.user.update({
            where: { email: userEmail },
            data: { password: hashedPassword }
        });

        return NextResponse.json({ success: true, message: 'Password aggiornata con successo' });

    } catch (error: any) {
        console.error('Change password error:', error);
        return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
    }
}
