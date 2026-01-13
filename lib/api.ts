
const API_BASE = '/api';

/**
 * Generic API call wrapper
 * Automatically handles JSON parsing and error throwing.
 * Cookies are sent automatically by the browser for same-origin requests.
 */
async function call<T>(path: string, method: string = 'GET', body?: any): Promise<T> {
    const url = `${API_BASE}${path}`;

    // Default headers
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };

    const opts: RequestInit = {
        method,
        headers,
    };

    if (body) {
        opts.body = JSON.stringify(body);
    }

    try {
        const res = await fetch(url, opts);

        // Handle 401: Redirect to login if needed (client-side)
        if (res.status === 401) {
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
                window.location.href = '/login';
            }
        }

        // Try to parse JSON, falling back to text if empty or not JSON
        const text = await res.text();
        let data: any;
        try {
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            data = { message: text || res.statusText };
        }

        if (!res.ok) {
            throw new Error(data.message || data.error || `Error ${res.status}: ${res.statusText}`);
        }

        return data as T;
    } catch (error: any) {
        // Rethrow with a clean message
        console.error(`API Call Failed [${method} ${path}]:`, error);
        throw new Error(error.message || 'Errore di connessione al server');
    }
}

// Type definitions for API payloads can be added here or in types/api.ts
// For now, using 'any' for legacy compatibility, to be refined later.

export const api = {
    // Auth
    login: (email: string, password: string) => call('/login', 'POST', { email, password }),
    logout: () => call('/auth/logout', 'POST'), // Note new path
    register: (data: any) => call('/register', 'POST', data),
    getProfile: () => call('/profile', 'GET'),
    updateProfile: (data: any) => call('/profile', 'PUT', data),
    getUsers: () => call('/users', 'GET'),
    deleteUser: (id: number | string) => call(`/users/${id}`, 'DELETE'),

    // Staff
    getStaff: () => call<any[]>('/staff', 'GET'),
    upsertStaff: (staff: any) => call('/staff', 'POST', staff),
    updateStaff: (id: number | string, staff: any) => call(`/staff/${id}`, 'PUT', staff),
    deleteStaff: (id: number | string) => call(`/staff/${id}`, 'DELETE'),
    importStaff: (list: any[]) => call('/staff/bulk', 'POST', list),

    // Schedule / Shift Templates
    getShiftTemplates: () => call<any[]>('/shift-templates', 'GET'),
    createShiftTemplate: (tmpl: any) => call('/shift-templates', 'POST', tmpl),

    // Assignments & Schedule
    getSchedule: (start: string, end: string) => call<any[]>(`/schedule?start=${start}&end=${end}`, 'GET'),
    generateSchedule: (start: string, end: string) => call('/generate-schedule', 'POST', { startDate: start, endDate: end }),
    createAssignment: (item: any) => call('/assignment', 'POST', item),
    updateAssignment: (id: number | string, item: any) => call(`/assignment/${id}`, 'PUT', item),
    deleteAssignment: (id: number | string) => call(`/assignment/${id}`, 'DELETE'),
    saveShiftBulk: (items: any[]) => call('/schedule/bulk', 'POST', items),
    verifySchedule: (start: string, end: string) => call('/verify-schedule', 'POST', { startDate: start, endDate: end }),
    findCandidates: (date: string, start: string, end: string, station: string) => call('/find-candidates', 'POST', { date, start, end, station }),

    // Unavailability
    getUnavailability: (start?: string, end?: string) => {
        let url = '/unavailability';
        const p = new URLSearchParams();
        if (start) p.append('startDate', start);
        if (end) p.append('endDate', end);
        if (start || end) url += `?${p.toString()}`;
        return call<any[]>(url, 'GET');
    },
    upsertUnavailability: (item: any) => call('/unavailability', 'POST', item),
    deleteUnavailability: (id: number | string) => call(`/unavailability/${id}`, 'DELETE'),

    // Forecast & Budget
    getForecast: (start?: string, end?: string) => {
        let qs = '';
        if (start && end) qs = `?start=${start}&end=${end}`;
        return call<any>(`/forecast${qs}`, 'GET');
    },
    getForecastHistory: () => call<any>('/forecast?start=2023-01-01', 'GET'), // Placeholder for history
    saveForecast: (rows: any[]) => call('/forecast', 'POST', { rows }),
    getBudget: (start?: string, end?: string) => {
        let qs = '';
        if (start && end) qs = `?start=${start}&end=${end}`;
        return call<any>(`/budget${qs}`, 'GET');
    },
    upsertBudget: (item: any) => call('/budget', 'POST', item),

    // Recurring Shifts
    getRecurringShifts: () => call<any>('/recurring-shifts', 'GET'),
    addRecurringShift: (data: any) => call('/recurring-shifts', 'POST', data),
    deleteRecurringShift: (id: number) => call(`/recurring-shifts/${id}`, 'DELETE'),

    // Schedule Actions
    clearAssignments: (start: string, end: string) => call(`/schedule?start=${start}&end=${end}`, 'DELETE'),

    // AI Agent
    chat: (message: string, history: any[], apiKey?: string) => call('/agent/chat', 'POST', { message, history, apiKey }),

    // Permission Requests
    getPermissionRequests: (params?: any) => {
        const p = new URLSearchParams(params || {});
        return call(`/permission-requests?${p.toString()}`, 'GET');
    },
    createPermissionRequest: (data: any) => call('/permission-requests', 'POST', data),
    getPendingRequestsCount: () => call('/permission-requests/pending-count', 'GET'),
    approveRequest: (id: string, response: string) => call(`/permission-requests/${id}/approve`, 'PUT', { adminResponse: response }),
    rejectRequest: (id: string, response: string) => call(`/permission-requests/${id}/reject`, 'PUT', { adminResponse: response }),
    // Coverage
    getCoverage: () => call<any[]>('/coverage', 'GET'),
    saveCoverage: (rows: any[]) => call('/coverage', 'POST', { rows }),
};

export default api;
