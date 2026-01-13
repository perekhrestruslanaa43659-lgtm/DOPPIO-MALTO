import { NextResponse } from 'next/server';

export async function POST() {
    // Create response
    const response = NextResponse.json(
        { message: 'Logout successful' },
        { status: 200 }
    );

    // Invalidate the token cookie
    response.cookies.set('token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: new Date(0),
        path: '/',
    });

    return response;
}
