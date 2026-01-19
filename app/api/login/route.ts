import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signToken, JWTPayload } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';

export async function POST(request: NextRequest) {
    try {
        console.log('\n=== LOGIN REQUEST START ===');
        const { email, password } = await request.json();
        console.log('📧 Email ricevuta:', email);
        console.log('🔑 Password presente:', !!password);

        if (!email || !password) {
            console.log('❌ Email o password mancanti');
            return NextResponse.json(
                { error: 'Email e password sono richiesti' },
                { status: 400 }
            );
        }

        // Find user by email
        console.log('🔍 Ricerca utente nel database...');
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            console.log('❌ Utente non trovato per email:', email);
            return NextResponse.json(
                { error: 'Credenziali non valide' },
                { status: 401 }
            );
        }
        console.log('✅ Utente trovato - ID:', user.id, 'Role:', user.role, 'TenantKey:', user.tenantKey);

        // Verify password
        console.log('🔐 Verifica password...');
        const isValid = await verifyPassword(password, user.password);

        if (!isValid) {
            console.log('❌ Password non valida per utente:', email);
            return NextResponse.json(
                { error: 'Credenziali non valide' },
                { status: 401 }
            );
        }
        console.log('✅ Password verificata con successo');

        // Create JWT token
        console.log('🎫 Creazione token JWT...');
        const tokenPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            tenantKey: user.tenantKey,
            companyName: user.companyName || undefined,
        };
        console.log('Token payload:', tokenPayload);
        const token = await signToken(tokenPayload);
        console.log('✅ Token creato (lunghezza:', token.length, 'caratteri)');

        // Create response with user data
        const response = NextResponse.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                tenantKey: user.tenantKey,
                companyName: user.companyName,
            },
        });

        // Set HTTP-only cookie with token
        console.log('🍪 Impostazione cookie...');
        response.cookies.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });
        console.log('✅ Cookie impostato con successo');
        console.log('=== LOGIN REQUEST SUCCESS ===\n');

        return response;
    } catch (error) {
        console.error('\n❌ === LOGIN ERROR ===');
        console.error('Tipo errore:', error instanceof Error ? error.constructor.name : typeof error);
        console.error('Messaggio:', error instanceof Error ? error.message : String(error));
        console.error('Stack:', error instanceof Error ? error.stack : 'N/A');
        console.error('======================\n');
        return NextResponse.json(
            { error: `Errore: ${error instanceof Error ? error.message : String(error)}` },
            { status: 500 }
        );
    }
}
