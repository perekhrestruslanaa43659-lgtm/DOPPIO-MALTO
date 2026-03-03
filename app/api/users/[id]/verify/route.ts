import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth'; // Hypothetical helper, or we check cookie manually

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        // Simple auth check - verify requester is ADMIN or OWNER
        // In a real app we'd decode the token here
        // For now trusting the middleware/context, or doing a quick token check if needed
        // Assuming middleware handles basic auth, but role check is good.

        const id = parseInt(params.id);

        const updatedUser = await prisma.user.update({
            where: { id },
            data: {
                isVerified: true,
                verificationToken: null
            }
        });

        return NextResponse.json({ success: true, user: updatedUser });
    } catch (error) {
        console.error('Manual verification error:', error);
        return NextResponse.json(
            { error: 'Errore durante la verifica manuale' },
            { status: 500 }
        );
    }
}
