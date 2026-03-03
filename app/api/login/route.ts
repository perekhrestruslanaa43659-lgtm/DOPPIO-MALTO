import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signToken, JWTPayload } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';
import { sendLoginNotification } from '@/lib/email';

export async function POST(request: NextRequest) {
    try {
        console.log('\n=== LOGIN REQUEST START ===');
        const { email: rawEmail, password } = await request.json();
        const email = rawEmail?.toLowerCase().trim(); // Optimize email

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
        // Try finding by exact match first, or use mode: 'insensitive' if Prisma supported it easily here without specific config
        // But better to enforce lowercase in DB. 
        const user = await prisma.user.findFirst({
            where: {
                email: {
                    equals: email,
                    mode: 'insensitive'
                }
            },
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

        if (!user.isVerified) {
            console.log('❌ Utente non verificato:', email);
            return NextResponse.json(
                { error: 'Account non verificato. Controlla la tua email.' },
                { status: 401 }
            );
        }

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

        // --- SMART LOGIN LOGIC ---
        const deviceTokenCookie = request.cookies.get('device_token')?.value;
        const userAgent = request.headers.get('user-agent') || 'Unknown';
        // Get IP - handling Vercel/proxies
        const forwardedFor = request.headers.get('x-forwarded-for');
        const ipAddress = forwardedFor ? forwardedFor.split(',')[0] : 'Unknown IP';

        let isNewDevice = true;
        let currentDeviceToken = deviceTokenCookie;

        if (currentDeviceToken) {
            // Check if valid
            const existingToken = await prisma.deviceToken.findUnique({
                where: { token: currentDeviceToken }
            });

            if (existingToken && existingToken.userId === user.id) {
                isNewDevice = false;
                // Update last used
                await prisma.deviceToken.update({
                    where: { id: existingToken.id },
                    data: { lastUsed: new Date() }
                });
            }
        }

        // If New Device -> Generate Token & Send Email
        if (isNewDevice) {
            // Generate new token
            // Node native crypto import
            const crypto = require('crypto');
            const newToken = crypto.randomBytes(32).toString('hex');

            await prisma.deviceToken.create({
                data: {
                    token: newToken,
                    userId: user.id,
                    userAgent: userAgent
                }
            });
            currentDeviceToken = newToken;

            // Send Email Notification ONLY if new device
            // await sendLoginNotification(user.email, user.name || 'Utente', new Date().toLocaleString('it-IT'), user.tenantKey);
            /* 
            try {
                const time = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' });
                await sendLoginNotification(user.email, user.name || 'Utente', time, user.tenantKey);
            } catch (emailError) {
                console.error('Errore invio email notifica:', emailError);
            }
            */
        }

        // Log the Event
        await prisma.loginLog.create({
            data: {
                userId: user.id,
                eventType: 'LOGIN',
                ipAddress: ipAddress,
                userAgent: userAgent,
                isNewDevice: isNewDevice
            }
        });

        // Create Response
        const response = NextResponse.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                tenantKey: user.tenantKey,
                companyName: user.companyName,
            }
        });

        // Set Auth Cookie
        response.cookies.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7 // 7 days
        });

        // Set Device Token Cookie (Long Lived - e.g. 1 year)
        if (currentDeviceToken) {
            response.cookies.set('device_token', currentDeviceToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60 * 24 * 365 // 1 year
            });
        }

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
