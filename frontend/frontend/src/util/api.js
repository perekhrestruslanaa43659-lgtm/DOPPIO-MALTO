const API_BASE = '/api';

async function call(path, method = 'GET', body) {
  const url = `${API_BASE}${path}`;
  const token = localStorage.getItem('token');
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    // Handle 401 logout?
    if (res.status === 401) {
      // Optionally clear token or redirect
      // localStorage.removeItem('token');
    }
    const text = await res.text();
    try {
      const err = JSON.parse(text);
      throw new Error(err.msg || err.error || res.statusText);
    } catch (e) {
      // If JSON parse fails (or logic above throws), fall back to text
      // But if the error was the logic above, we want that message.
      // So check if 'e' is our constructed error.
      if (e.message && (e.message !== 'Unexpected token' && !e.message.includes('JSON'))) {
        throw e;
      }
      throw new Error(text || res.statusText);
    }
  }
  return res.json();
}

export default {
  // Auth
  login: (email, password) => call('/login', 'POST', { email, password }),
  register: (data) => call('/register', 'POST', data), // { name, email, password, role }
  getUsers: () => call('/users', 'GET'),
  deleteUser: (id) => call(`/users/${id}`, 'DELETE'),
  getProfile: () => call('/profile', 'GET'),
  updateProfile: (data) => call('/profile', 'PUT', data),

  // Staff
  getStaff: () => call('/staff', 'GET'),
  upsertStaff: (staff) => call('/staff', 'POST', staff), // POST handles create
  updateStaff: (id, staff) => call(`/staff/${id}`, 'PUT', staff),
  importStaff: (list) => call('/staff/bulk', 'POST', list),
  deleteStaff: (id) => call(`/staff/${id}`, 'DELETE'),

  // Shift Templates (Turni Tipi)
  getShiftTemplates: () => call('/shift-templates', 'GET'),
  createShiftTemplate: (tmpl) => call('/shift-templates', 'POST', tmpl),

  // Unavailability
  getUnavailability: (start, end) => {
    let url = '/unavailability';
    if (start || end) {
      const p = new URLSearchParams();
      if (start) p.append('startDate', start);
      if (end) p.append('endDate', end);
      url += `?${p.toString()}`;
    }
    return call(url, 'GET');
  },
  upsertUnavailability: (item) => call('/unavailability', 'POST', item),
  deleteUnavailability: (id) => call(`/unavailability/${id}`, 'DELETE'),
  getActivityHistory: (start, end) => {
    let url = '/activity-history';
    if (start || end) {
      const p = new URLSearchParams();
      if (start) p.append('startDate', start);
      if (end) p.append('endDate', end);
      url += `?${p.toString()}`;
    }
    return call(url, 'GET');
  },

  // Budget
  getBudget: () => call('/budget', 'GET'),
  upsertBudget: (item) => call('/budget', 'POST', item),

  // Assignments
  generateSchedule: (start, end) => call('/generate-schedule', 'POST', { startDate: start, endDate: end }),
  getSchedule: (start, end) => call(`/schedule?start=${start}&end=${end}`, 'GET'),
  saveShiftBulk: (items) => call('/schedule/bulk', 'POST', items),
  createAssignment: (item) => call('/assignment', 'POST', item),
  updateAssignment: (id, item) => call(`/assignment/${id}`, 'PUT', item),
  deleteAssignment: (id) => call(`/assignment/${id}`, 'DELETE'),
  clearAssignments: (start, end) => call('/assignments/clear', 'POST', { startDate: start, endDate: end }),

  // Coverage
  getCoverage: () => call('/coverage', 'GET'),
  saveCoverage: (rows) => call('/coverage', 'POST', { rows }),
  verifySchedule: (start, end) => call('/verify-schedule', 'POST', { startDate: start, endDate: end }),
  findCandidates: (date, start, end, station) => call('/find-candidates', 'POST', { date, start, end, station }),
  saveAvailability: (payload) => call('/availability', 'POST', payload),
  publishAssignments: (payload) => call('/assignments/publish', 'POST', payload),

  // Forecast
  getForecast: () => call('/forecast', 'GET'),
  getForecastHistory: () => call('/forecast/history', 'GET'),
  saveForecast: (rows) => call('/forecast', 'POST', { rows }),

  // Export
  exportCsvWeek3: (startDate, endDate) => call('/export-week3', 'POST', { startDate, endDate }),

  // Recurring Shifts
  getRecurringShifts: () => call('/recurring-shifts', 'GET'),
  addRecurringShift: (data) => call('/recurring-shifts', 'POST', data),
  deleteRecurringShift: (id) => call(`/recurring-shifts/${id}`, 'DELETE'),

  // AI Agent
  chat: (message) => call('/agent/chat', 'POST', { message }),

  // Permission Requests
  createPermissionRequest: (data) => call('/permission-requests', 'POST', data),
  getPermissionRequests: (params) => {
    const p = new URLSearchParams(params || {});
    return call(`/permission-requests?${p.toString()}`, 'GET');
  },
  getPendingRequestsCount: () => call('/permission-requests/pending-count', 'GET'),
  approveRequest: (id, response) => call(`/permission-requests/${id}/approve`, 'PUT', { adminResponse: response }),
  rejectRequest: (id, response) => call(`/permission-requests/${id}/reject`, 'PUT', { adminResponse: response }),

  // Auth
  logout: () => call('/logout', 'POST'),
  heartbeat: () => call('/heartbeat', 'POST'),
}
