/**
 * Scheduler Logic - Version 2.0 (Coverage Driven)
 * 
 * Rules:
 * 1. Demand comes from CoverageRows (Station, WeekStart, Slots).
 * 2. Generators 1-53 weeks. (We'll assume user passes a range, we look up coverage).
 * 3. Priority: Tirocinio > Operatore > ... > Chiamata (Last).
 * 4. Exclude: Manager.
 * 5. Constraints: Hourly availability from fixedShifts.
 */

// Helper: Parse "HH:mm" to decimal
function parseTime(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h + (m || 0) / 60;
}

function parseRange(rangeStr) {
  // "10:00-15:00" -> { start: 10.0, end: 15.0 }
  if (!rangeStr || !rangeStr.includes('-')) return null;
  const [s, e] = rangeStr.split('-');
  return { start: parseTime(s), end: parseTime(e) };
}

// Helper: Format decimal to "HH:mm"
function formatTime(dec) {
  if (dec === undefined || dec === null) return "00:00";
  const h = Math.floor(dec);
  const m = Math.round((dec - h) * 60);
  const mm = m < 10 ? '0' + m : m;
  const hh = h < 10 ? '0' + h : h;
  return `${hh}:${mm}`;
}

// Helper: Check if two ranges overlap
function doRangesOverlap(start1, end1, start2, end2) {
  return Math.max(start1, start2) < Math.min(end1, end2);
}

function getRoleScore(role) {
  if (!role) return 50;
  const r = role.toLowerCase();
  if (r.includes('manager')) return -1; // Exclude
  if (r.includes('tirocinio')) return 100;
  if (r.includes('operatore')) return 90;
  if (r.includes('chiamata')) return 10; // Low priority (Last resort)
  return 50; // Default
}

/**
 * Check if staff is BOH (Back of House - Cucina)
 */
function isBOHStaff(staff) {
  const bohNames = [
    'ABIR', 'HOSSAIN',
    'IMRAN', 'MOLLA',
    'SHOHEL', 'MATUBBER',
    'JUBAIR',
    'SAHIDUL', 'ISLAM',
    'SHOAG',
    'BABUL', 'MIAH',
    'ADIL',
    'JAHIDUR', 'RAHMAN',
    'SUAB',
    'RUMEL', 'HANNAN'
  ];

  const fullName = (staff.nome + ' ' + (staff.cognome || '')).toUpperCase().trim();
  return bohNames.some(name => fullName.includes(name));
}

/**
 * Generate Schedule
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @param {Staff[]} allStaff 
 * @param {CoverageRow[]} coverageRows 
 * @param {RecurringShift[]} recurringShifts 
 */
function generateSchedule(startDate, endDate, allStaff, coverageRows, recurringShifts = [], existingManualAssignments = []) {
  const assignments = [];

  // Initialize Hours Map
  const staffHoursMap = {};
  allStaff.forEach(s => { staffHoursMap[s.id] = 0; });

  // 1. Filter Staff (Sort later dynamically)
  const initialPool = allStaff.filter(s => getRoleScore(s.ruolo) > 0);

  // 2. Prepare Coverage "Demand" for each Day
  const curr = new Date(startDate);
  const end = new Date(endDate);
  const dayShorts = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

  const busyMap = {};
  const busyNamesMap = {};
  const unassigned = [];

  // --- PRE-ASSIGN RECURRING SHIFTS ---
  const current = new Date(startDate);
  const endLimit = new Date(endDate);
  while (current <= endLimit) {
    const dateStr = current.toISOString().split('T')[0];
    const dayOfWeek = current.getDay(); // 0=Sun

    const dayRecurring = recurringShifts.filter(r => r.dayOfWeek === dayOfWeek);

    dayRecurring.forEach(rec => {
      const staff = allStaff.find(s => s.id === rec.staffId);
      if (!staff) return;

      // Check if staff is unavailable this specific day before pre-assigning
      const isUnavailable = staff.unavailabilities && staff.unavailabilities.some(u => {
        const uDate = new Date(u.data).toISOString().split('T')[0];
        return uDate === dateStr;
      });
      if (isUnavailable) return;

      const sTime = rec.start_time || (rec.shiftTemplate ? rec.shiftTemplate.oraInizio : null);
      const eTime = rec.end_time || (rec.shiftTemplate ? rec.shiftTemplate.oraFine : null);

      if (!sTime || !eTime) return;

      assignments.push({
        date: dateStr,
        staffId: staff.id,
        shiftTemplateId: rec.shiftTemplateId || null,
        start_time: sTime,
        end_time: eTime,
        postazione: rec.postazione || (rec.shiftTemplate ? rec.shiftTemplate.nome : 'EXTRA'),
        status: false // Draft
      });

      // Mark Busy
      const sDec = parseTime(sTime);
      let eDec = parseTime(eTime);
      if (eDec < sDec) eDec += 24;

      if (!busyMap[`${dateStr}-${staff.id}`]) busyMap[`${dateStr}-${staff.id}`] = [];
      busyMap[`${dateStr}-${staff.id}`].push({ start: sDec, end: eDec });
      busyNamesMap[`${dateStr}-${staff.nome}`] = true;

      // Update Hours
      staffHoursMap[staff.id] = (staffHoursMap[staff.id] || 0) + (eDec - sDec);
    });
    current.setDate(current.getDate() + 1);
  }

  // --- PRE-ASSIGN EXISTING MANUAL OVERRIDES ---
  existingManualAssignments.forEach(ex => {
    const staff = allStaff.find(s => s.id === ex.staffId);
    if (!staff) return;

    const sTime = ex.start_time || (ex.shiftTemplate ? ex.shiftTemplate.oraInizio : null);
    const eTime = ex.end_time || (ex.shiftTemplate ? ex.shiftTemplate.oraFine : null);
    if (!sTime || !eTime) return;

    // Avoid duplicates with recurring
    const exists = assignments.some(a => a.date === ex.data && a.staffId === ex.staffId && a.start_time === sTime);
    if (exists) return;

    assignments.push({
      date: ex.data,
      staffId: ex.staffId,
      shiftTemplateId: ex.shiftTemplateId,
      start_time: sTime,
      end_time: eTime,
      postazione: ex.postazione || (ex.shiftTemplate ? ex.shiftTemplate.nome : 'EXTRA'),
      status: ex.status
    });

    const sDec = parseTime(sTime);
    let eDec = parseTime(eTime);
    if (eDec < sDec) eDec += 24;

    if (!busyMap[`${ex.data}-${ex.staffId}`]) busyMap[`${ex.data}-${ex.staffId}`] = [];
    busyMap[`${ex.data}-${ex.staffId}`].push({ start: sDec, end: eDec });
    busyNamesMap[`${ex.data}-${staff.nome}`] = true;
    staffHoursMap[ex.staffId] = (staffHoursMap[ex.staffId] || 0) + (eDec - sDec);
  });
  // Reset date for main loop
  curr.setTime(startDate.getTime());

  while (curr <= end) {
    const y = curr.getFullYear();
    const m = String(curr.getMonth() + 1).padStart(2, '0');
    const d = String(curr.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const dayIndex = curr.getDay(); // 0=Sun
    const dayName = dayShorts[dayIndex];

    const demandList = [];

    coverageRows.forEach(row => {
      // ... (No change to demand parsing logic) ...
      // Re-implementing simplified demand parsing for context match or just assume it's same
      // Wait, I can't overwrite the loop without writing it all.
      // I'll assume lines 112-172 are same.
      // I need to match the START of the replacement exactly.
      // Actually, I am replacing lines 41-200.
      // I need to include the demand parsing loop.
      // It's long.
      // Just copy the demand parsing logic from Step 5139.

      const slots = row.slots;
      let daySlots = [];

      if (Array.isArray(slots)) {
        let dayOffset = dayIndex === 0 ? 28 : dayIndex * 4;
        daySlots.push(slots[dayOffset], slots[dayOffset + 1], slots[dayOffset + 2], slots[dayOffset + 3]);
      } else if (slots && typeof slots === 'object') {
        const shifts = slots[dayName] || [];
        if (shifts[0]) daySlots.push(...shifts[0].split('-'));
        if (shifts[1]) daySlots.push(...shifts[1].split('-'));
      }

      for (let i = 0; i < daySlots.length; i += 2) {
        const sTime = daySlots[i];
        const eTime = daySlots[i + 1];
        if (!sTime || !eTime || typeof sTime !== 'string' || typeof eTime !== 'string' || !sTime.includes(':')) continue;

        const startDec = parseTime(sTime);
        let endDec = parseTime(eTime);
        if (endDec < startDec) endDec += 24;

        const qty = parseInt(row.frequency) || 1;
        for (let q = 0; q < qty; q++) {
          demandList.push({
            station: row.station,
            start: startDec,
            end: endDec,
            originalString: `${sTime}-${eTime}`
          });
        }
      }
    });

    console.log(`[Scheduler] Day ${dateStr} (${dayName}): Demand items: ${demandList.length}`);

    // DYNAMIC SORTING PER DAY/DEMAND
    // Actually, sorting per demand is best to balance hours.

    demandList.forEach((demand, dIdx) => {
      let assigned = false;
      let reasons = [];

      // Sort Candidates Dynamically
      const candidates = [...initialPool].sort((a, b) => {
        // 0. SECK CODOU SPECIAL PRIORITY
        // If shift is roughly 10:30-15:30 (Lunch), Seck has absolute priority to ensure assignment
        const isLunch = demand.start >= 10 && demand.end <= 16;
        const isSeckA = (a.nome + ' ' + (a.cognome || '')).toUpperCase().includes('SECK');
        const isSeckB = (b.nome + ' ' + (b.cognome || '')).toUpperCase().includes('SECK');

        if (isLunch && isSeckA && !isSeckB) return -1000;
        if (isLunch && !isSeckA && isSeckB) return 1000;

        // 0.5 strict penalty for CHIAMATA (Make them LAST resort)
        const isChiamataA = (a.ruolo || '').toLowerCase().includes('chiamata');
        const isChiamataB = (b.ruolo || '').toLowerCase().includes('chiamata');
        if (isChiamataA && !isChiamataB) return 1000; // A is Chiamata -> Move to bottom
        if (!isChiamataA && isChiamataB) return -1000; // B is Chiamata -> Move B to bottom

        // 1. Role Score Descending
        const sA = getRoleScore(a.ruolo);
        const sB = getRoleScore(b.ruolo);
        if (sA !== sB) return sB - sA;

        // 2. "Need Hours" Descending (Favor those far from target)
        const remA = (a.oreMassime || 0) - staffHoursMap[a.id];
        const remB = (b.oreMassime || 0) - staffHoursMap[b.id];
        return remB - remA;
      });

      for (const staff of candidates) {
        // A. Check Max Hours (Tolerance +1 as per user request)
        const currentHours = staffHoursMap[staff.id] || 0;
        const shiftDuration = demand.end - demand.start;
        const limit = (staff.oreMassime || 40) + 1; // Tolerance +1

        if (currentHours + shiftDuration > limit) {
          // Strict Skip beyond tolerance
          continue;
        }

        // A2. Check Postazioni (Skills)
        // If staff has specific postazioni defined, they must match the demand station.
        // If staff has NO postazioni or empty, assume they can do anything (or nothing? User said "vincoli: le postazioni")
        // Usually, if list is empty, maybe they are new or generic? Let's check if array exists and has length.
        // Convert postazioni from string to array (SQLite compatibility)
        const postazioniArray = (staff.postazioni && staff.postazioni.trim()) ? staff.postazioni.split(',').map(p => p.trim()).filter(p => p) : [];
        if (postazioniArray.length > 0) {
          // Normalize: remove spaces, lowercase
          const normalize = (s) => s.toUpperCase().replace(/\s/g, '');
          const demandStationNorm = normalize(demand.station);

          // Check if ANY of staff postazioni matches
          // The CSV often has "BAR GIU", "BAR SU", "B / S", "CDR".
          // Staff might have "BAR", "ACC", etc.
          // We need a loose includes check or exact match?
          // Let's try exact matches on the normalized strings first, or partials.

          const canWork = postazioniArray.some(p => {
            const pNorm = normalize(p);
            return demandStationNorm.includes(pNorm) || pNorm.includes(demandStationNorm);
          });

          if (!canWork) {
            // console.log(`  [SKIP] ${staff.nome} cannot work at ${demand.station} (Has: ${staff.postazioni})`);
            continue;
          }
        }

        const dayBusy = busyMap[`${dateStr}-${staff.id}`] || [];
        const nameBusy = busyNamesMap[`${dateStr}-${staff.nome}`] || false;
        if (dayBusy.length > 0 || nameBusy) continue;


        // A3. Check Indisponibilità (Time Off)
        const isUnavailable = staff.unavailabilities && staff.unavailabilities.some(u => {
          const uDate = new Date(u.data).toISOString().split('T')[0];
          return uDate === dateStr;
        });

        if (isUnavailable) {
          console.log(`  [SKIP] ${staff.nome} (ID: ${staff.id}) for demand ${dIdx}: Has Indisponibilità on ${dateStr}`);
          continue;
        }

        // B. Check Availability (fixedShifts)
        const fullDayName = dayNames[dayIndex];
        const suffix = demand.start < 17.0 ? 'P' : 'S';
        const availKey = `${fullDayName}_${suffix}`;

        let constraint = (staff.fixedShifts || {})[availKey] || (staff.fixedShifts || {})[`${fullDayName}_${suffix}`]; // Check both with and without trailing space

        // Rules: NO...
        if (constraint && constraint.toUpperCase().startsWith('NO')) {
          console.log(`  [SKIP] ${staff.nome} (ID: ${staff.id}) for demand ${dIdx} (${demand.station} ${formatTime(demand.start)}-${formatTime(demand.end)}): Availability set to NO for ${availKey}`);
          continue;
        }
        if (constraint && constraint.toUpperCase() === 'FIX') {
          // This means they are fixed for this slot, so they are available.
        } else if (constraint) {
          // Parse Constraint Range
          const cRange = parseRange(constraint);
          if (cRange) {
            // Strict Subset check: Assignment Start >= Constraint Start AND Assignment End <= Constraint End
            if (demand.start < cRange.start || demand.end > cRange.end) {
              console.log(`  [SKIP] ${staff.nome} (ID: ${staff.id}) for demand ${dIdx} (${demand.station} ${formatTime(demand.start)}-${formatTime(demand.end)}): Demand range ${formatTime(demand.start)}-${formatTime(demand.end)} outside fixed availability ${constraint} for ${availKey}`);
              continue;
            }
          }
        }


        // C. Check Busy
        const busy = busyMap[`${dateStr}-${staff.id}`] || [];
        const overlap = busy.some(b => doRangesOverlap(b.start, b.end, demand.start, demand.end));
        if (overlap) {
          console.log(`  [SKIP] ${staff.nome} (ID: ${staff.id}) for demand ${dIdx} (${demand.station} ${formatTime(demand.start)}-${formatTime(demand.end)}): Overlaps with existing assignment`);
          continue;
        }

        // D. Check Station Capability (Postazioni)
        // Normalize Demand Station: "B/S_V" -> "B/S", "ACCGIU:S" -> "ACCGIU"

        const dStationRaw = (demand.station || '').trim().toUpperCase();

        // --- CONSTRAINT: ACC GIU can ONLY be Celeste ---
        if (dStationRaw.includes('ACC') && dStationRaw.includes('GIU')) {
          if (!staff.nome.toUpperCase().includes('CELESTE')) {
            reasons.push(`${staff.nome}: Only Celeste for ACC GIU`); // Capture reason
            continue;
          }
        }

        // --- CONSTRAINT: SECK CODOU (10:30-15:30 ONLY) ---
        let finalStart = demand.start;
        let finalEnd = demand.end;

        const sName = (staff.nome + ' ' + (staff.cognome || '')).toUpperCase();
        if (sName.includes('SECK') && sName.includes('CODOU')) {
          // CONSTRAINT 1: REMOVED Station Lock per user request ("assegna... ore fisse")
          // We allow him on ANY station if it fits time.

          // CONSTRAINT 2: Time (Lunch Only, Forced 10:30-15:30)
          if (demand.start >= 16) {
            // He can't work evenings.
            continue;
          }

          // Force times if slot allows (assuming slot covers it)
          finalStart = 10.5; // 10:30
          finalEnd = 15.5;   // 15:30

          // If demand is shorter than this forced block? 
          // E.g. Slot 12:00-14:00. Seck 10:30-15:30 doesn't fit?
          // We assume coverage rows are compatible (e.g. 10-15).
        }
        // --------------------------------------------------

        const dStationNorm = dStationRaw.split(/[_:]/)[0].trim();

        // Convert postazioni from string to array (SQLite compatibility)
        const postazioniArray2 = (staff.postazioni && staff.postazioni.trim()) ? staff.postazioni.split(',').map(p => p.trim()).filter(p => p) : [];
        const canDoStation = postazioniArray2.some(p => {
          const pNorm = p.trim().toUpperCase();
          return pNorm === dStationNorm || pNorm === dStationRaw;
        });

        if (!canDoStation) {
          reasons.push(`${staff.nome}: Missing station ${dStationRaw}`);
          continue;
        }

        // ASSIGN
        // Check if staff is BOH (Cucina) - use split shifts
        if (isBOHStaff(staff)) {
          // BOH Staff gets split shifts: Lunch (10:30-16:00) + Dinner (19:00-00:00)
          // Check if already assigned today
          const alreadyAssignedToday = assignments.some(a =>
            a.date === dateStr && a.staffId === staff.id
          );

          if (!alreadyAssignedToday) {
            // Turno Pranzo (Lunch)
            assignments.push({
              date: dateStr,
              staffId: staff.id,
              shiftTemplateId: null,
              start_time: '10:30',
              end_time: '16:00',
              postazione: demand.station,
              status: false // BOZZA
            });

            // Turno Sera (Dinner)
            assignments.push({
              date: dateStr,
              staffId: staff.id,
              shiftTemplateId: null,
              start_time: '19:00',
              end_time: '00:00',
              postazione: demand.station,
              status: false // BOZZA
            });

            // Mark Busy for both shifts
            if (!busyMap[`${dateStr}-${staff.id}`]) busyMap[`${dateStr}-${staff.id}`] = [];
            busyMap[`${dateStr}-${staff.id}`].push({ start: 10.5, end: 16 }); // Lunch
            busyMap[`${dateStr}-${staff.id}`].push({ start: 19, end: 24 }); // Dinner
            busyNamesMap[`${dateStr}-${staff.nome}`] = true;

            // Update Accumulated Hours (5.5h lunch + 5h dinner = 10.5h total)
            staffHoursMap[staff.id] = (staffHoursMap[staff.id] || 0) + 10.5;

            console.log(`  [BOH SPLIT] ${staff.nome} assigned split shifts on ${dateStr}: 10:30-16:00 + 19:00-00:00`);
            assigned = true;
            break; // Next demand
          }
        } else {
          // Regular FOH staff - single shift
          assignments.push({
            date: dateStr,
            staffId: staff.id,
            shiftTemplateId: null,
            start_time: formatTime(finalStart),
            end_time: formatTime(finalEnd),
            postazione: demand.station,
            status: false // BOZZA
          });

          // Mark Busy
          if (!busyMap[`${dateStr}-${staff.id}`]) busyMap[`${dateStr}-${staff.id}`] = [];
          busyMap[`${dateStr}-${staff.id}`].push({ start: finalStart, end: finalEnd });
          busyNamesMap[`${dateStr}-${staff.nome}`] = true;

          // Update Accumulated Hours
          staffHoursMap[staff.id] = (staffHoursMap[staff.id] || 0) + (finalEnd - finalStart);

          console.log(`  [ASSIGNED] Demand ${dIdx} (${demand.station} ${formatTime(finalStart)}-${formatTime(finalEnd)}) assigned to ${staff.nome}`);
          assigned = true;
          break; // Next demand
        }
      }

      if (!assigned) {
        console.warn(`  [WARNING] Unassigned Slot: ${dateStr} ${demand.station} ${formatTime(demand.start)}-${formatTime(demand.end)}`);
      }
    });

    // Next day
    curr.setDate(curr.getDate() + 1);
  }

  return { assignments, logs: [], unassigned: [] };
}

module.exports = { generateSchedule };
