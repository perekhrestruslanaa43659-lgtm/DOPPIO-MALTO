import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

// Routes that don't require authentication
const publicRoutes = ['/login', '/register'];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip middleware for API routes - REMOVED to allow header injection
    // if (pathname.startsWith('/api/')) {
    //    return NextResponse.next();
    // }

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
        console.log('\n🔐 MIDDLEWARE: Token trovato, verifica in corso...');
        console.log('   Path:', pathname);
        try {
            // Verify token
            const decoded = await verifyToken(token);
            console.log('✅ Token verificato per utente:', decoded.email);
            console.log('   - UserID:', decoded.userId);
            console.log('   - Role:', decoded.role);

            // RBAC Logic
            const role = (decoded.role || '').toUpperCase();
            const isRestrictedUser = role !== 'ADMIN' && role !== 'MANAGER' && role !== 'OWNER';

            // List of restricted paths for non-admin users
            const restrictedPaths = [
                '/staff',
                '/fixed-shifts',
                '/absences',
                '/requirements',
                '/forecast',
                '/users',
                '/settings'
            ];

            if (isRestrictedUser && restrictedPaths.some(path => pathname.startsWith(path))) {
                console.log('⛔ Accesso negato per ruolo:', role, 'al path:', pathname);
                return NextResponse.redirect(new URL('/calendar', request.url));
            }

            // Add user info to headers for API routes
            const requestHeaders = new Headers(request.headers);

            if (decoded.userId) requestHeaders.set('x-user-id', String(decoded.userId));
            if (decoded.email) requestHeaders.set('x-user-email', decoded.email);
            if (decoded.role) requestHeaders.set('x-user-role', decoded.role);
            if (decoded.tenantKey) requestHeaders.set('x-user-tenant-key', decoded.tenantKey);

            if (decoded.companyName) {
                requestHeaders.set('x-user-company', decoded.companyName);
            }
            console.log('📤 Headers iniettati nella richiesta\n');

            return NextResponse.next({
                request: {
                    headers: requestHeaders,
                },
            });
        } catch (error) {
            console.log('❌ MIDDLEWARE: Token non valido o scaduto');
            console.log('   Errore:', error instanceof Error ? error.message : String(error));
            // Invalid token, normally redirect to login, but for preview we continue
            // return NextResponse.redirect(new URL('/login', request.url));
        }
    } else {
        console.log('⚠️  MIDDLEWARE: Nessun token trovato per path:', pathname);
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
