import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/crypto'; // Import crypto

export async function GET(request: Request) {
    try {
        // Mock Tenant (Replace with actual auth logic if available)
        const tenantKey = 'default-tenant';

        const integrations = await prisma.integration.findMany({
            where: { tenantKey }
        });

        // MASK SECRETS before sending to client
        const safeIntegrations = integrations.map((int: any) => ({
            ...int,
            apiKey: int.apiKey ? `${int.apiKey.substring(0, 4)}...` : '', // Masked
            apiSecret: int.apiSecret ? '***MASKED***' : '', // Fully masked
        }));

        return NextResponse.json(safeIntegrations);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const tenantKey = 'default-tenant';
        const body = await request.json();
        const { provider, apiKey, apiSecret, apiUrl, status, config } = body;

        if (!provider) {
            return NextResponse.json({ error: 'Provider is required' }, { status: 400 });
        }

        // ENCRYPT SECRETS before saving
        // Only encrypt if a new value is provided (not for empty updates)
        const updateData: any = {
            apiUrl,
            status,
            config: config ? JSON.stringify(config) : undefined,
        };

        if (apiKey) updateData.apiKey = encrypt(apiKey);
        if (apiSecret) updateData.apiSecret = encrypt(apiSecret);

        const integration = await prisma.integration.upsert({
            where: {
                provider_tenantKey: {
                    provider,
                    tenantKey
                }
            },
            update: updateData,
            create: {
                tenantKey,
                provider,
                apiKey: apiKey ? encrypt(apiKey) : null,
                apiSecret: apiSecret ? encrypt(apiSecret) : null,
                apiUrl,
                status: status || 'INACTIVE',
                config: config ? JSON.stringify(config) : '{}',
            }
        });

        // Return sane response (don't echo back encrypted/raw secrets)
        return NextResponse.json({
            ...integration,
            apiKey: apiKey ? '***SAVED***' : '',
            apiSecret: apiSecret ? '***SAVED***' : ''
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
