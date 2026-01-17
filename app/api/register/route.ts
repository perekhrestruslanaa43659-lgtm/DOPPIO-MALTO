import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { getSMTPConfig } from '@/lib/smtp-providers';

export async function POST(request: NextRequest) {
    try {
        const requestBody = await request.json();
        const { email, password, name, role, companyName } = requestBody;

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

        // Create user as restaurant owner
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: role || 'OWNER',
                tenantKey,
                companyName,
                // Save SMTP config
                smtpHost: finalHost,
                smtpPort: finalPort,
                smtpUser: requestBody.smtpUser,
                smtpPassword: requestBody.smtpPassword
            },
        });

        return NextResponse.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                tenantKey: user.tenantKey,
                companyName: user.companyName,
            },
        });
    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json(
            { error: 'Errore interno del server' },
            { status: 500 }
        );
    }
}
