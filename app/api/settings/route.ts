
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getSMTPConfig } from '@/lib/smtp-providers';

export const dynamic = 'force-dynamic';

// GET: Retrieve current user's settings (excluding password for security, or just obfuscated)
export async function GET(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');
        // We need the ACTUAL user ID to find THEIR specific settings if we are storing them on the User model.
        // The middleware passes `x-user-id`? Let's check middleware. 
        // If not, we might need to rely on the fact that the requester is the OWNER of the tenant.
        // Actually, `api/users` uses `tenantKey`.
        // Let's rely on finding the OWNER of this tenant.

        if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

        const owner = await prisma.user.findFirst({
            where: {
                tenantKey: tenantKey,
                role: 'OWNER'
            },
            select: {
                smtpHost: true,
                smtpPort: true,
                smtpUser: true,
                smtpPassword: true // We need to select it to check if it exists (but we won't return it)
            }
        });

        if (!owner) {
            return NextResponse.json({ error: 'Owner not found' }, { status: 404 });
        }

        return NextResponse.json({
            smtpHost: owner.smtpHost || '',
            smtpPort: owner.smtpPort || '',
            smtpUser: owner.smtpUser || '',
            hasPassword: !!owner.smtpPassword
        });

    } catch (error) {
        console.error('Error fetching settings:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// PUT: Update settings
export async function PUT(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');
        const userRole = request.headers.get('x-user-role');

        if (!tenantKey) return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });

        // Only Admin/Owner can change this
        if (userRole !== 'ADMIN' && userRole !== 'OWNER') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await request.json();
        const { provider, smtpHost, smtpPort, smtpUser, smtpPassword } = body;

        // Find Owner to update
        const owner = await prisma.user.findFirst({
            where: {
                tenantKey: tenantKey,
                role: 'OWNER'
            }
        });

        if (!owner) {
            return NextResponse.json({ error: 'Owner not found' }, { status: 404 });
        }

        // Prepare update data
        let finalHost = smtpHost;
        let finalPort = smtpPort ? parseInt(smtpPort) : null;

        // If provider is specified, use auto-configuration
        if (provider && provider !== 'CUSTOM') {
            const config = getSMTPConfig(provider);
            finalHost = config.host;
            finalPort = config.port;
        }

        const updateData: any = {
            smtpHost: finalHost,
            smtpPort: finalPort,
            smtpUser,
        };

        // Only update password if provided (allow leaving blank to keep existing)
        if (smtpPassword && smtpPassword.trim() !== '') {
            updateData.smtpPassword = smtpPassword;
        }

        await prisma.user.update({
            where: { id: owner.id },
            data: updateData
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error updating settings:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
