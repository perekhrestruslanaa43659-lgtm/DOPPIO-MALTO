
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        // Headers set by Middleware
        const userEmail = request.headers.get('x-user-email');

        if (!userEmail) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { email: userEmail },
            select: {
                id: true,
                email: true,
                name: true,
                surname: true,
                role: true,
                tenantKey: true,
                companyName: true,
            },
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(user);
    } catch (error) {
        console.error('Profile error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
