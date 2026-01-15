
const BASE_URL = '/api';

async function request(endpoint: string, options: RequestInit = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Error ${res.status}`);
    }
    return res.json();
}

export const api = {
    // --- Auth & Users ---
    // CORRECTED PATHS based on actual file structure
    login: (creds: any) => request('/login', { method: 'POST', body: JSON.stringify(creds) }),
    logout: () => request('/logout', { method: 'POST' }),
    getProfile: () => request('/profile'),
    register: (data: any) => request('/register', { method: 'POST', body: JSON.stringify(data) }),

    getUsers: () => request('/users'),
    deleteUser: (id: number) => request(`/users?id=${id}`, { method: 'DELETE' }),

    // --- Staff ---
    getStaff: () => request('/staff'),
    updateStaff: (id: number, data: any) => request(`/staff?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    upsertStaff: (data: any) => request('/staff', { method: 'POST', body: JSON.stringify(data) }),
    deleteStaff: (id: number) => request(`/staff?id=${id}`, { method: 'DELETE' }),
    deleteAllStaff: () => request('/staff?all=true', { method: 'DELETE' }),
    importStaff: (data: any[]) => request('/staff/import', { method: 'POST', body: JSON.stringify(data) }),

    // --- Schedule & Assignments ---
    getSchedule: (start: string, end: string) => request(`/schedule?start=${start}&end=${end}`),
    generateSchedule: (start: string, end: string) => request(`/schedule/generate`, { method: 'POST', body: JSON.stringify({ start, end }) }),
    clearAssignments: (start: string, end: string) => request(`/schedule/clear`, { method: 'POST', body: JSON.stringify({ start, end }) }),

    createAssignment: (data: any) => request('/assignment', { method: 'POST', body: JSON.stringify(data) }),
    updateAssignment: (id: number | any, data?: any) => {
        if (typeof id === 'object') return request('/assignment', { method: 'PUT', body: JSON.stringify(id) });
        return request(`/assignment?id=${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    deleteAssignment: (id: number) => request(`/assignment?id=${id}`, { method: 'DELETE' }),
    getShiftTemplates: () => request('/shift-templates'),

    // --- Unavailability & Absences ---
    getUnavailability: (start: string, end: string) => request(`/unavailability?start=${start}&end=${end}`),
    addUnavailability: (data: any) => request('/unavailability', { method: 'POST', body: JSON.stringify(data) }),
    upsertUnavailability: (data: any) => request('/unavailability', { method: 'POST', body: JSON.stringify(data) }),
    deleteUnavailability: (id: number) => request(`/unavailability?id=${id}`, { method: 'DELETE' }),

    getAbsences: () => request('/absences'),
    updateAbsence: (id: number, status: string) => request(`/absences`, { method: 'PUT', body: JSON.stringify({ id, status }) }),

    // --- Recurring Shifts ---
    getRecurringShifts: () => request('/recurring-shifts'),
    addRecurringShift: (data: any) => request('/recurring-shifts/create', { method: 'POST', body: JSON.stringify(data) }),
    updateRecurringShift: (id: number, data: any) => request('/recurring-shifts/update', { method: 'POST', body: JSON.stringify({ id, ...data }) }),
    deleteRecurringShift: (id: number) => request(`/recurring-shifts/delete`, { method: 'POST', body: JSON.stringify({ id }) }),
    applyFixedShifts: (year: number, week: number) => request('/schedule/apply-fixed', { method: 'POST', body: JSON.stringify({ year, week }) }),

    // --- Forecast & Budget ---
    getForecast: (start: string, end: string) => request(`/forecast?start=${start}&end=${end}`),
    saveForecast: (data: any) => request('/forecast', { method: 'POST', body: JSON.stringify(data) }),
    deleteForecast: (id: number) => request(`/forecast?id=${id}`, { method: 'DELETE' }),

    getBudget: (start: string, end: string) => request(`/budget?start=${start}&end=${end}`),
    upsertBudget: (data: any) => request('/budget', { method: 'POST', body: JSON.stringify(data) }),

    // --- Deployment / Coverage ---
    getCoverage: () => request('/requirements'),

    // --- Permissions Requests ---
    getPermissionRequests: () => request('/permission-requests'),
    createPermissionRequest: (data: any) => request('/permission-requests', { method: 'POST', body: JSON.stringify(data) }),
    approveRequest: (id: string, response: string) => request(`/permission-requests/${id}/approve`, { method: 'POST', body: JSON.stringify({ adminResponse: response }) }),
    rejectRequest: (id: string, response: string) => request(`/permission-requests/${id}/reject`, { method: 'POST', body: JSON.stringify({ adminResponse: response }) }),
    getPendingRequestsCount: () => request('/permission-requests/count'),

    // --- AI ---
    chat: (message: string, history: any[], apiKey?: string) => request('/agent/chat', { method: 'POST', body: JSON.stringify({ message, history, apiKey }) }),
};
