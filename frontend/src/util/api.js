const API_BASE = 'http://localhost:4000/api';

async function call(path, method = 'GET', body) {
  const url = `${API_BASE}${path}`;
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default {
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
  getUnavailability: () => call('/unavailability', 'GET'),
  upsertUnavailability: (item) => call('/unavailability', 'POST', item),

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

  // Export
  exportCsvWeek3: (startDate, endDate) => call('/export-week3', 'POST', { startDate, endDate }),

  // AI Agent
  chat: (message) => call('/agent/chat', 'POST', { message }),
}
