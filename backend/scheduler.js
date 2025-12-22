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

// Rank Roles
function getRoleScore(role) {
  if (!role) return 50;
  const r = role.toLowerCase();
  if (r.includes('manager')) return -1; // Exclude
  if (r.includes('tirocinio')) return 100;
  if (r.includes('operatore')) return 90;
  if (r.includes('chiamata')) return 10;
  return 50; // Default
}

/**
 * Generate Schedule
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @param {Staff[]} allStaff 
 * @param {CoverageRow[]} coverageRows 
 */
function generateSchedule(startDate, endDate, allStaff, coverageRows) {
  const assignments = [];

  // 1. Filter & Sort Staff
  const elegibleStaff = allStaff
    .filter(s => getRoleScore(s.ruolo) > 0)
    .sort((a, b) => {
      // Primary: Role Priority
      const scoreA = getRoleScore(a.ruolo);
      const scoreB = getRoleScore(b.ruolo);
      if (scoreA !== scoreB) return scoreB - scoreA;
      // Secondary: Cost? Random? For now keep stable.
      return a.id - b.id;
    });

  // 2. Prepare Coverage "Demand" for each Day
  // CoverageRow usually has "slots" = object { "Lun": ["09:00-13:00", ...], "Mar": ... }
  // We iterate each day in range.

  const curr = new Date(startDate);
  const end = new Date(endDate);

  // Helper to get day name Italian
  const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const dayShorts = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

  // Track Staff Busy Times per Day: { "YYYY-MM-DD-StaffID": [{start, end}, ...] }
  const busyMap = {};
  const busyNamesMap = {}; // Extra safety for same-name duplicates

  const unassigned = []; // Track failed assignments

  // Track accumulated hours per staff member: { staffId: totalHours }
  const staffHoursMap = {};
  allStaff.forEach(s => { staffHoursMap[s.id] = 0; });

  while (curr <= end) {
    // Force "Local" YYYY-MM-DD
    const y = curr.getFullYear();
    const m = String(curr.getMonth() + 1).padStart(2, '0');
    const d = String(curr.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const dayIndex = curr.getDay(); // 0=Sun
    const dayName = dayShorts[dayIndex]; // "Lun"

    // Find applicable coverage rows (assume active for all weeks or filter by weekStart if provided)
    // For MVP, we use ALL coverage rows (merged).

    // We need to flatten the "Demand List" for this day.
    // Demand Item: { station, start, end }
    const demandList = [];

    coverageRows.forEach(row => {
      const slots = row.slots;

      // Determine day-specific slots from the array (32 items: 8 blocks of 4)
      // Block 1 (0-3): Settimana (Master)
      // Block 2 (4-7): Lunedì
      // ...
      // Block 7 (24-27): Sabato
      // Block 8 (28-31): Domenica

      let daySlots = [];

      if (Array.isArray(slots)) {
        // Array Format (32 items)
        let dayOffset = -1;
        if (dayIndex === 0) dayOffset = 28; // Sunday
        else dayOffset = dayIndex * 4;      // Mon-Sat

        daySlots.push(slots[dayOffset]);     // Start1
        daySlots.push(slots[dayOffset + 1]); // End1
        daySlots.push(slots[dayOffset + 2]); // Start2
        daySlots.push(slots[dayOffset + 3]); // End3
      } else if (slots && typeof slots === 'object') {
        // Object Format { "Lun": ["10:00-15:00"], ... }
        const shifts = slots[dayName] || []; // dayName is Lun, Mar...
        if (shifts[0]) {
          const [s, e] = shifts[0].split('-');
          daySlots.push(s, e);
        }
        if (shifts[1]) {
          const [s, e] = shifts[1].split('-');
          daySlots.push(s, e);
        }
      }

      // Iterate pairs
      for (let i = 0; i < daySlots.length; i += 2) {
        const sTime = daySlots[i];
        const eTime = daySlots[i + 1];

        // Verify valid times
        if (!sTime || !eTime || !sTime.includes(':')) continue;

        const startDec = parseTime(sTime);
        const endDec = parseTime(eTime);
        if (!startDec && startDec !== 0) continue;

        let effectiveEnd = endDec;
        if (effectiveEnd < startDec) effectiveEnd += 24; // Handle night shift crossing midnight

        const qty = parseInt(row.frequency) || 1;
        for (let q = 0; q < qty; q++) {
          demandList.push({
            station: row.station,
            start: startDec,
            end: effectiveEnd,
            originalString: `${sTime}-${eTime}`
          });
        }
      }
    });

    // 3. Fulfill Demand
    // Sort demand? Longer shifts first? 
    // demandList.sort((a,b) => (b.end - b.start) - (a.end - a.start));

    console.log(`[Scheduler] Day ${dateStr} (${dayName}): Demand items: ${demandList.length}, Eligible Staff: ${elegibleStaff.length}`);

    demandList.forEach((demand, dIdx) => {
      // Find best candidate
      let assigned = false;

      for (const staff of elegibleStaff) {
        // A. Check Max Hours
        const currentHours = staffHoursMap[staff.id] || 0;
        const shiftDuration = demand.end - demand.start;
        if (currentHours + shiftDuration > (staff.oreMassime || 40)) {
          console.log(`  [SKIP] ${staff.nome} (ID: ${staff.id}) for demand ${dIdx}: Would exceed max hours (${(currentHours + shiftDuration).toFixed(1)} > ${staff.oreMassime})`);
          continue;
        }

        // A2. Check Double Shift Restriction (AI only)
        const dayBusy = busyMap[`${dateStr}-${staff.id}`] || [];
        const nameBusy = busyNamesMap[`${dateStr}-${staff.nome}`] || false;

        if (dayBusy.length > 0 || nameBusy) {
          console.log(`  [SKIP] ${staff.nome} (ID: ${staff.id}) for demand ${dIdx}: Already has a shift today`);
          continue;
        }

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
        // Also handle "ACC/OPS" vs "ACC"?

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
          // CONSTRAINT 1: Only BAR SU
          if (!dStationRaw.includes('BARSU') && !(dStationRaw.includes('BAR') && dStationRaw.includes('SU'))) {
            reasons.push(`${staff.nome}: Can only do BAR SU`);
            continue;
          }

          // CONSTRAINT 2: Time (Lunch Only, Forced 10:30-15:30)
          if (demand.start >= 16) {
            reasons.push(`${staff.nome}: Can only do 10:30-15:30 (Lunch)`);
            continue;
          }
          finalStart = 10.5; // 10:30
          finalEnd = 15.5;   // 15:30
        }
        // --------------------------------------------------

        const dStationNorm = dStationRaw.split(/[_:]/)[0].trim();

        const canDoStation = (staff.postazioni || []).some(p => {
          const pNorm = p.trim().toUpperCase();
          return pNorm === dStationNorm || pNorm === dStationRaw;
        });

        if (!canDoStation) {
          reasons.push(`${staff.nome}: Missing station ${dStationRaw}`);
          continue;
        }

        // ASSIGN
        assignments.push({
          date: dateStr,
          staffId: staff.id,
          shiftTemplateId: null,
          customStart: formatTime(finalStart),
          customEnd: formatTime(finalEnd),
          postazione: demand.station,
          status: 'BOZZA'
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

      if (!assigned) {
        console.warn(`  [WARNING] Unassigned Slot: ${dateStr} ${demand.station} ${formatTime(demand.start)}-${formatTime(demand.end)}`);
      }
    });

    // Next day
    curr.setDate(curr.getDate() + 1);
  }

  return { assignments };
}

module.exports = { generateSchedule };
