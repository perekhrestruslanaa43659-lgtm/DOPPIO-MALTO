import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signToken, JWTPayload } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { getSMTPConfig } from '@/lib/smtp-providers';
import { sendVerificationEmail } from '@/lib/email';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
    try {
        const requestBody = await request.json();
        const { email: rawEmail, password, name, role, companyName } = requestBody;
        const email = rawEmail?.toLowerCase().trim();

        if (!email || !password || !name) {
            return NextResponse.json(
                { error: 'Email, password e nome sono richiesti' },
                { status: 400 }
            );
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return NextResponse.json(
                { error: 'Un utente con questa email esiste già' },
                { status: 400 }
            );
        }

        // Generate unique tenantKey
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 11);
        const tenantKey = `tenant-${timestamp}-${randomStr}`;

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Determine SMTP configuration
        let finalHost = requestBody.smtpHost;
        let finalPort = requestBody.smtpPort ? parseInt(requestBody.smtpPort) : null;

        // If provider is specified, use auto-configuration
        if (requestBody.provider && requestBody.provider !== 'CUSTOM') {
            const config = getSMTPConfig(requestBody.provider);
            finalHost = config.host;
            finalPort = config.port;
        }

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // Check if SMTP is configured - needed to send verification email
        const smtpConfigured = finalHost && finalPort && requestBody.smtpUser && requestBody.smtpPassword;

        // If SMTP is configured, require email verification. Otherwise, auto-verify.
        const shouldRequireVerification = smtpConfigured;

        // Create user as restaurant owner
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: role || 'OWNER',
                tenantKey,
                companyName,
                isVerified: !shouldRequireVerification, // Se SMTP non è configurato, auto-verifica
                verificationToken: shouldRequireVerification ? verificationToken : null, // Salva il token solo se serve
                // Save SMTP config
                smtpHost: finalHost,
                smtpPort: finalPort,
                smtpUser: requestBody.smtpUser,
                smtpPassword: requestBody.smtpPassword
            },
        });

        // Send verification email only if SMTP is configured (non-blocking)
        if (shouldRequireVerification) {
            const baseUrl = request.headers.get('x-forwarded-proto') && request.headers.get('x-forwarded-host')
                ? `${request.headers.get('x-forwarded-proto')}://${request.headers.get('x-forwarded-host')}`
                : process.env.NEXT_PUBLIC_APP_URL || 'https://scheduling-nextjs-mu.vercel.app';

            sendVerificationEmail(
                user.email,
                verificationToken,
                user.tenantKey,
                user.name || '',
                baseUrl
            ).catch(err => {
                console.error('Failed to send verification email during registration:', err);
            });
        }

        return NextResponse.json({
            requiresVerification: shouldRequireVerification,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                tenantKey: user.tenantKey,
                companyName: user.companyName,
            },
            message: shouldRequireVerification
                ? 'Verifica email inviata. Per favore controlla la tua email per un link di verifica.'
                : 'Registrazione completata! Puoi accedere subito. Configura SMTP nelle impostazioni per inviare email al tuo team.'
        });
    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json(
            { error: 'Errore interno del server' },
            { status: 500 }
        );
    }
}
