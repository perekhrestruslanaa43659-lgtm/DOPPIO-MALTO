import { NextRequest } from 'next/server';
import { verifyToken } from './auth';

/**
 * Genera un tenantKey univoco per un nuovo locale/ristorante
 * Formato: tenant-{timestamp}-{random}
 */
export function generateTenantKey(): string {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 11);
    return `tenant-${timestamp}-${randomStr}`;
}

/**
 * Estrae il tenantKey dal token JWT nella request
 * @param request - NextRequest object
 * @returns tenantKey o null se non trovato
 */
export async function getTenantFromRequest(request: NextRequest): Promise<string | null> {
    try {
        const token = request.cookies.get('token')?.value;

        if (!token) {
            return null;
        }

        const decoded = await verifyToken(token);

        if (!decoded || typeof decoded === 'string') {
            return null;
        }

        return decoded.tenantKey || null;
    } catch (error) {
        console.error('Error extracting tenant from request:', error);
        return null;
    }
}

/**
 * Helper per aggiungere filtro tenantKey alle query Prisma
 * @param tenantKey - Il tenantKey da usare per filtrare
 * @returns Oggetto da usare nelle query Prisma
 */
export function tenantFilter(tenantKey: string) {
    return { tenantKey };
}

/**
 * Valida che un tenantKey sia nel formato corretto
 * @param tenantKey - Il tenantKey da validare
 * @returns true se valido, false altrimenti
 */
export function isValidTenantKey(tenantKey: string): boolean {
    // Formato: tenant-{timestamp}-{random}
    const pattern = /^tenant-\d+-[a-z0-9]+$/;
    return pattern.test(tenantKey);
}
