const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function call(path, method = 'GET', body) {
  const url = `${API_BASE}${path}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include' // For cookies/sessions if needed
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || `HTTP ${res.status}`);
  }
  return res.json();
}

export default {
  // Staff endpoints
  getStaff: () => call('/staff', 'GET'),
  createStaff: (staff) => call('/staff', 'POST', staff),
  updateStaff: (id, staff) => call(`/staff/${id}`, 'PUT', staff),
  deleteStaff: (id) => call(`/staff/${id}`, 'DELETE'),

  // Schedule/Turni endpoints
  getSchedule: (start, end) => call(`/schedule?start=${start}&end=${end}`, 'GET'),
  generateSchedule: (startDate, endDate) => call('/generate-schedule', 'POST', { startDate, endDate }),
  createAssignment: (assignment) => call('/assignment', 'POST', assignment),

  // Legacy compatibility (if needed)
  upsertStaff: (staff) => {
    // If staff has an id, update, otherwise create
    if (staff.id) {
      return call(`/staff/${staff.id}`, 'PUT', staff);
    } else {
      return call('/staff', 'POST', staff);
    }
  },

  getTurni: () => call('/schedule', 'GET'),
  upsertTurno: (turno) => call('/assignment', 'POST', turno)
}
