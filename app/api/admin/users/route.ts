import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

export async function GET(req: NextRequest) {
    try {
        // Auth Check
        const token = cookies().get('token')?.value;
        if (!token) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

        const decoded: any = jwt.verify(token, JWT_SECRET);
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

        if (!user || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
            return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 });
        }

        // Fetch Users (Scoping to tenant usually, but for OWNER maybe all? Let's scope to tenant for safety)
        // If the user is a super-admin, maybe all. But let's stick to tenant.
        const users = await prisma.user.findMany({
            where: { tenantKey: user.tenantKey },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                tenantKey: true,
                lastLogin: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ users });

    } catch (error: any) {
        console.error('API Admin Users Error:', error);
        return NextResponse.json({ error: 'Errore server' }, { status: 500 });
    }
}
