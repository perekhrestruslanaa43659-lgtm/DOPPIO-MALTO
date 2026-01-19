import { SignJWT, jwtVerify } from 'jose';

// Password functions moved to @/lib/password.ts to support Edge Runtime

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const encodedKey = new TextEncoder().encode(JWT_SECRET);

// Warn if using fallback secret in production
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    console.warn('WARNING: JWT_SECRET not set in production! Using fallback secret.');
}

export interface JWTPayload {
    userId: number;
    email: string;
    role: string;
    tenantKey: string;
    companyName?: string;
    [key: string]: any; // Allow extra claims for jose compatibility
}

/**
 * Sign a JWT token with user data
 */
export async function signToken(payload: JWTPayload): Promise<string> {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(encodedKey);
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<JWTPayload> {
    try {
        const { payload } = await jwtVerify(token, encodedKey);
        return payload as unknown as JWTPayload;
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
}

/**
 * Extract token from Authorization header or cookies
 */
export function extractToken(authHeader?: string | null): string | null {
    if (!authHeader) return null;

    if (authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    return authHeader;
}
