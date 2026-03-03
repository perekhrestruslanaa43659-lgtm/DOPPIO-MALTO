
const BASE_URL = '/api';

async function request(endpoint: string, options: RequestInit = {}) {
    const method = options.method || 'GET';
    console.log(`\n🌐 === API CALL START ===`);
    console.log(`   Method: ${method}`);
    console.log(`   Endpoint: ${endpoint}`);
    if (options.body) {
        // SECURITY: Mask sensitive fields before logging
        const bodyStr = String(options.body);
        const maskedBody = bodyStr.replace(/"(password|apiKey|apiSecret|token|secret)":\s*"[^"]*"/g, '"$1": "***MASKED***"');
        const bodyPreview = maskedBody.substring(0, 200);
        console.log(`   Body preview: ${bodyPreview}${maskedBody.length > 200 ? '...' : ''}`);
    }

    const headers = { 'Content-Type': 'application/json', ...options.headers };
    const startTime = performance.now();

    try {
        const res = await fetch(`${BASE_URL}${endpoint}`, { cache: 'no-store', ...options, headers });
        const duration = Math.round(performance.now() - startTime);

        console.log(`📡 API Response: ${res.status} ${res.statusText} (${duration}ms)`);

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.error(`❌ API Error: ${err.message || `Error ${res.status}`}`);
            console.log(`=== API CALL END (ERROR) ===\n`);
            throw new Error(err.message || `Error ${res.status}`);
        }

        const data = await res.json();
        console.log(`✅ Response data:`, typeof data === 'object' && Array.isArray(data) ? `Array(${data.length})` : typeof data);
        console.log(`=== API CALL END (SUCCESS) ===\n`);
        return data;
    } catch (error) {
        const duration = Math.round(performance.now() - startTime);
        console.error(`❌ === API CALL FAILED (${duration}ms) ===`);
        console.error(`   Error:`, error);
        console.log(`=========================\n`);
        throw error;
    }
}

export const api = {
    // --- Auth & Users ---
    // CORRECTED PATHS based on actual file structure
    login: (creds: any) => request('/login', { method: 'POST', body: JSON.stringify(creds) }),
    getClosingStats: (start: string, end: string) => request(`/stats/closings?start=${start}&end=${end}`),
    logout: () => request('/logout', { method: 'POST' }),
    getProfile: () => request('/profile'),
    changePassword: (currentPassword: string, newPassword: string) => request('/profile/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
    register: (data: any) => request('/register', { method: 'POST', body: JSON.stringify(data) }),

    getUsers: () => request('/users'),
    updateUser: (data: any) => request('/users', { method: 'PUT', body: JSON.stringify(data) }),

    createUser: (data: any) => request('/users', { method: 'POST', body: JSON.stringify(data) }),

    deleteUser: (id: number) => request(`/users?id=${id}`, { method: 'DELETE' }),

    // --- Settings ---
    getSettings: () => request('/settings'),
    updateSettings: (data: any) => request('/settings', { method: 'PUT', body: JSON.stringify(data) }),

    // --- Staff ---
    getStaff: () => request('/staff'),
    updateStaff: (id: number, data: any) => request(`/staff?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    patchStaff: (id: number, data: any) => request(`/staff?id=${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    upsertStaff: (data: any) => request('/staff', { method: 'POST', body: JSON.stringify(data) }),
    deleteStaff: (id: number) => request(`/staff?id=${id}`, { method: 'DELETE' }),
    deleteAllStaff: () => request('/staff?all=true', { method: 'DELETE' }),
    importStaff: (data: any[]) => request('/staff/import', { method: 'POST', body: JSON.stringify(data) }),

    // --- Schedule & Assignments ---
    getSchedule: async (start: string, end: string) => {
        const data = await request(`/schedule?start=${start}&end=${end}`);
        // Handle legacy array response vs new object response
        if (Array.isArray(data)) {
            return { assignments: data, requests: [], unavailabilities: [] };
        }
        return data;
    },
    generateSchedule: (start: string, end: string) => request(`/schedule/generate`, { method: 'POST', body: JSON.stringify({ start, end }) }),
    clearAssignments: (start: string, end: string) => request(`/schedule/clear`, { method: 'POST', body: JSON.stringify({ start, end }) }),
    validateSchedule: (start: string, end: string) => request(`/schedule/validate?start=${start}&end=${end}`),
    auditSchedule: (start: string, end: string) => request(`/schedule/audit?start=${start}&end=${end}`),

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
    deleteAllUnavailability: () => request('/unavailability/delete-all', { method: 'DELETE' }),
    deleteMultipleUnavailability: (ids: number[]) => request('/unavailability/delete-multiple', { method: 'POST', body: JSON.stringify({ ids }) }),

    getAbsences: () => request('/absences'),
    updateAbsence: (id: number, status: string) => request(`/absences`, { method: 'PUT', body: JSON.stringify({ id, status }) }),

    // --- Availability ---
    getAvailability: (staffId?: number) => request(`/availability${staffId ? `?staffId=${staffId}` : ''}`),
    addAvailability: (data: any) => request('/availability', { method: 'POST', body: JSON.stringify(data) }),
    deleteAvailability: (id: number) => request(`/availability?id=${id}`, { method: 'DELETE' }),

    // --- Recurring Shifts ---
    getRecurringShifts: () => request('/recurring-shifts'),
    addRecurringShift: (data: any) => request('/recurring-shifts/create', { method: 'POST', body: JSON.stringify(data) }),
    updateRecurringShift: (id: number, data: any) => request('/recurring-shifts/update', { method: 'POST', body: JSON.stringify({ id, ...data }) }),
    deleteRecurringShift: (id: number) => request(`/recurring-shifts/delete`, { method: 'POST', body: JSON.stringify({ id }) }),
    applyFixedShifts: (year: number, week: number) => request('/schedule/apply-fixed', { method: 'POST', body: JSON.stringify({ year, week }) }),

    // --- Forecast & Budget ---
    getForecast: (start: string, end: string) => request(`/forecast?start=${start}&end=${end}`),
    saveForecast: (data: any) => request('/forecast', { method: 'POST', body: JSON.stringify(data) }),
    deleteForecast: (weekStart: string) => request(`/forecast?weekStart=${weekStart}`, { method: 'DELETE' }),

    notifyBroadcast: (weekRange: string, htmlTable: string) => request('/notifications/broadcast-schedule', { method: 'POST', body: JSON.stringify({ weekRange, htmlTable }) }),

    getBudget: (start: string, end: string) => request(`/budget?start=${start}&end=${end}`),
    saveBudget: (data: any) => request('/budget', { method: 'POST', body: JSON.stringify(data) }),
    upsertBudget: (data: any) => request('/budget', { method: 'POST', body: JSON.stringify(data) }),

    // --- Deployment / Coverage ---
    getCoverage: (date?: string) => request(`/requirements${date ? `?date=${date}` : ''}`),
    saveCoverage: (data: any) => request('/requirements', { method: 'POST', body: JSON.stringify(data) }),

    // --- Permissions Requests ---
    getPermissionRequests: () => request('/permission-requests'),
    createPermissionRequest: (data: any) => request('/permission-requests', { method: 'POST', body: JSON.stringify(data) }),
    approveRequest: (id: string, response: string) => request(`/permission-requests/${id}/approve`, { method: 'POST', body: JSON.stringify({ adminResponse: response }) }),
    rejectRequest: (id: string, response: string) => request(`/permission-requests/${id}/reject`, { method: 'POST', body: JSON.stringify({ adminResponse: response }) }),
    deletePermissionRequest: (id: string | number) => request(`/permission-requests/${id}`, { method: 'DELETE' }),
    getPendingRequestsCount: () => request('/permission-requests/count'),

    // --- AI & Training ---
    chat: (message: string, history: any[], apiKey?: string) => request('/agent/chat', { method: 'POST', body: JSON.stringify({ message, history, apiKey }) }),

    // Admin Training Data
    trainAI: (data: any) => request('/training', { method: 'POST', body: JSON.stringify(data) }),
    getTrainingData: () => request('/training'),

    // --- Integrations ---
    getIntegrations: () => request('/integrations'),
    saveIntegration: (data: any) => request('/integrations', { method: 'POST', body: JSON.stringify(data) }),

    // --- Closings ---
    updateBudget: (date: string, data: any) => request(`/budget?date=${date}`, { method: 'PUT', body: JSON.stringify(data) }),
    sendClosingReport: (start: string, end: string, recipient: string) => request('/email/summary', { method: 'POST', body: JSON.stringify({ start, end, recipient }) }),
};
