
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
// Ensure this exists or use bcrypt directly if lib/auth not present
import crypto from 'crypto';
import { sendWelcomeEmail } from '@/lib/email';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');
        if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

        const users = await prisma.user.findMany({
            where: { tenantKey },
            select: {
                id: true,
                email: true,
                name: true,
                surname: true,
                role: true,
                companyName: true,
                createdAt: true,
                tenantKey: true
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');
        if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

        const body = await request.json();
        const { id, name, surname, email, role, password } = body;

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const updateData: any = { name, surname, email, role };

        if (password && password.length >= 6) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateData.password = hashedPassword;
        }

        const updatedUser = await prisma.user.update({
            where: { id: parseInt(id), tenantKey }, // Ensure tenant safety
            data: updateData
        });

        return NextResponse.json({ success: true, user: updatedUser });
    } catch (error: any) {
        console.error('Error updating user:', error);
        return NextResponse.json({ error: error.message || 'Error updating user' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');
        const userRole = request.headers.get('x-user-role'); // Helper headers set by middleware usually, or we trust logic 

        if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

        // Only Admin can add users
        const canManage = userRole === 'ADMIN' || userRole === 'OWNER' || userRole === 'MANAGER';
        if (!canManage) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const body = await request.json();
        const { name, surname, email, role } = body;

        if (!email || !name) {
            return NextResponse.json({ error: 'Nome e Email richiesti' }, { status: 400 });
        }

        // Check duplicates
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return NextResponse.json({ error: 'Email già in uso' }, { status: 400 });

        // Generate Password or use provided
        let rawPassword = body.password;
        if (!rawPassword || rawPassword.trim() === "") {
            rawPassword = crypto.randomBytes(4).toString('hex'); // 8 chars
        }

        const hashedPassword = await bcrypt.hash(rawPassword, 10);

        // Find company name from requesting user (owner usually) not strictly needed but good for reference
        // We just need to attach correct tenantKey

        // Generate Verification Token
        const verificationToken = crypto.randomBytes(32).toString('hex');

        const newUser = await prisma.user.create({
            data: {
                name,
                surname,
                email,
                password: hashedPassword,
                role: role || 'USER',
                tenantKey: tenantKey, // LINK TO SAME TENANT
                companyName: 'Linked Account', // Or fetch owner's company
                isVerified: false, // Default to false
                verificationToken: verificationToken
            }
        });

        // Send Email
        // Send Verification Email
        // We also send credentials so they have them, but tell them to verify first.
        const verifyResult = await sendWelcomeEmail(email, name, rawPassword, tenantKey); // Existing Credentials Email
        // Ideally we merge them or send two. Sending verification separately for clarity.
        // Actually, let's update sendWelcomeEmail to include the link? 
        // No, keep separation of concerns. 
        // Let's import sendVerificationEmail.
        // Wait, import needs to be updated.
        // Assuming imports are updated.

        // For now, I will send the verification email.
        const { sendVerificationEmail } = await import('@/lib/email');
        const verificationResult = await sendVerificationEmail(
            email,
            verificationToken,
            tenantKey,
            name,
            process.env.NEXT_PUBLIC_APP_URL || 'https://scheduling-nextjs-mu.vercel.app'
        );

        return NextResponse.json({
            success: true,
            user: { ...newUser, password: null },
            emailSent: verifyResult.success && verificationResult.success,
            emailError: verifyResult.error || verificationResult.error
        });

    } catch (error: any) {
        console.error('Error creating user:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    // Basic DELETE based on logic
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const tenantKey = request.headers.get('x-user-tenant-key');
        if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

        await prisma.user.delete({
            where: { id: parseInt(id), tenantKey } // Ensure safety
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: 'Error' }, { status: 500 });
    }
}
