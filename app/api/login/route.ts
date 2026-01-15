import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, signToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email e password sono richiesti' },
                { status: 400 }
            );
        }

        // Find user by email
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return NextResponse.json(
                { error: 'Credenziali non valide' },
                { status: 401 }
            );
        }

        // Verify password
        const isValid = await verifyPassword(password, user.password);

        if (!isValid) {
            return NextResponse.json(
                { error: 'Credenziali non valide' },
                { status: 401 }
            );
        }

        // Create JWT token
        const token = await signToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            tenantKey: user.tenantKey,
            companyName: user.companyName || undefined,
        });

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
        response.cookies.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: `Errore: ${error instanceof Error ? error.message : String(error)}` },
            { status: 500 }
        );
    }
}
