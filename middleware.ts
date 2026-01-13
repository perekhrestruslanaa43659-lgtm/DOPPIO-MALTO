import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

// Routes that don't require authentication
const publicRoutes = ['/login', '/register'];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip middleware for API routes
    if (pathname.startsWith('/api/')) {
        return NextResponse.next();
    }

    // Allow public routes
    if (publicRoutes.some(route => pathname.startsWith(route))) {
        return NextResponse.next();
    }

    // Check for token in cookies
    // const token = request.cookies.get('token')?.value;

    // if (!token) {
    //    return NextResponse.redirect(new URL('/login', request.url));
    // }
    const token = request.cookies.get('token')?.value;

    if (token) {
        try {
            // Verify token
            const decoded = verifyToken(token);

            // Add user info to headers for API routes
            const requestHeaders = new Headers(request.headers);
            requestHeaders.set('x-user-id', decoded.userId.toString());
            requestHeaders.set('x-user-email', decoded.email);
            requestHeaders.set('x-user-role', decoded.role);
            requestHeaders.set('x-user-tenant-key', decoded.tenantKey);
            if (decoded.companyName) {
                requestHeaders.set('x-user-company', decoded.companyName);
            }

            return NextResponse.next({
                request: {
                    headers: requestHeaders,
                },
            });
        } catch (error) {
            // Invalid token, normally redirect to login, but for preview we continue
            // return NextResponse.redirect(new URL('/login', request.url));
        }
    }

    // No token or invalid token: continue without user headers (Guest mode)
    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
