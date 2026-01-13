
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const tenantKey = request.headers.get('x-user-tenant-key');

        if (!tenantKey) {
            return NextResponse.json({ error: 'Tenant key required' }, { status: 400 });
        }

        const count = await prisma.permissionRequest.count({
            where: {
                status: 'PENDING',
                Staff: {
                    tenantKey: tenantKey
                }
            },
        });

        return NextResponse.json({ count });
    } catch (error) {
        console.error('Error fetching pending requests count:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
