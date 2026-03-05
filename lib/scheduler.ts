
import { prisma } from '@/lib/prisma';
import { addMinutes, differenceInMinutes, parseISO, isSameDay, startOfDay, getISOWeek } from 'date-fns';

import _ from 'lodash';
import { z } from 'zod';

// --- Types ---

const AssignmentSchema = z.object({
    staffId: z.number(),
    date: z.string(), // YYYY-MM-DD
    startTime: z.string(), // HH:MM
    endTime: z.string(), // HH:MM
    station: z.string()
});

type AssignmentCandidate = {
    staffId: number;
    score: number;
    tags: string[]; // e.g. 'SENIOR', 'LOW_HOURS'
};

// --- Helpers ---

function toMinutes(time: string) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

function getShiftDate(dateStr: string, timeStr: string) {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(dateStr);
    d.setHours(h, m, 0, 0);
    return d;
}

// --- Core Algorithm ---

export async function generateSmartSchedule(startDate: string, endDate: string, tenantKey: string) {

<<<<<<< Updated upstream
    // 1. Data Gathering
    // ----------------
=======
    try {
        // 1. Data Gathering
        // ----------------
        const startD = new Date(startDate);
        const endD = new Date(endDate);

        // Buffer for 11h rest check AND Equity (1 month history)
        const queryStart = new Date(startD);
        queryStart.setDate(queryStart.getDate() - 30);

        console.log(`📊 Fetching data from database...`);

        const [staffListRaw, coverageRows, existingAssignments, recurringShifts, approvedPermissions, trainingDataRaw, budgetRows, staffCompetencies] = await Promise.all([
            (prisma.staff.findMany({
                where: { tenantKey },
                include: { unavailabilities: true }
            }) as Promise<any[]>).then((list: any[]) => list.filter((s: any) => !s.archived)).catch(e => { console.error('❌ Error fetching staff:', e); throw e; }),
            prisma.coverageRow.findMany({
                where: {
                    tenantKey,
                    weekStart: {
                        gte: queryStart.toISOString().split('T')[0],
                        lte: endDate
                    }
                }
            }).catch(e => { console.error('❌ Error fetching coverage:', e); throw e; }),
            prisma.assignment.findMany({
                where: {
                    tenantKey,
                    data: { gte: queryStart.toISOString().split('T')[0] }
                }
            }).catch(e => { console.error('❌ Error fetching assignments:', e); throw e; }),
            prisma.recurringShift.findMany({
                where: { tenantKey }
            }).catch(e => { console.error('❌ Error fetching recurring shifts:', e); throw e; }),
            prisma.permissionRequest.findMany({
                where: {
                    Staff: { tenantKey },
                    status: 'APPROVED',
                    data: { gte: queryStart.toISOString().split('T')[0], lte: endDate }
                }
            }).catch(e => { console.error('❌ Error fetching permissions:', e); throw e; }),
            (prisma as any).trainingData.findMany({
                where: { tenantKey },
                orderBy: { date: 'desc' },
                take: 20
            }).catch((e: any) => { console.error('❌ Error fetching training data:', e); return []; }),
            // ── Budget rows for cover-count check (manager constraint) ──
            prisma.budget.findMany({
                where: { tenantKey, data: { gte: startDate, lte: endDate } }
            }).catch((e: any) => { console.error('⚠️ Error fetching budget for manager rule:', e); return []; }),
            // ── Staff Competencies for Skill Filter ──
            prisma.staffCompetency.findMany({
                where: { tenantKey }
            }).catch((e: any) => { console.error('⚠️ Error fetching competencies:', e); return []; })
        ]);

        console.log(`✅ Data fetched successfully:`);
        console.log(`   Staff: ${staffListRaw.length}`);
        console.log(`   Coverage Rows: ${coverageRows.length}`);
        console.log(`   Existing Assignments: ${existingAssignments.length}`);
        console.log(`   Recurring Shifts: ${recurringShifts.length}`);
        console.log(`   Approved Permissions: ${approvedPermissions.length}`);
        console.log(`   Staff Competencies: ${(staffCompetencies as any[]).length}`);

        // ── Load Scheduling Rules from DB ────────────────────────────────────────────
        let dbRules: any[] = [];
        try {
            dbRules = await (prisma as any).schedulingRule.findMany({
                where: { tenantKey },
            });
            // Seed defaults if first run
            if (dbRules.length === 0) {
                console.log('[Scheduler] 🌱 No rules found — seeding built-in defaults');
                for (const rule of BUILTIN_RULES) {
                    await (prisma as any).schedulingRule.upsert({
                        where: { tenantKey_code: { tenantKey, code: rule.code } },
                        update: {},
                        create: { tenantKey, ...rule },
                    }).catch(() => { });
                }
                dbRules = BUILTIN_RULES.map((r, i) => ({ id: i, tenantKey, ...r }));
            }
        } catch (e) {
            console.warn('[Scheduler] ⚠️ Could not load scheduling rules from DB (table may not exist yet). Using all defaults as enabled.');
            dbRules = BUILTIN_RULES.map((r, i) => ({ id: i, tenantKey, ...r }));
        }
        const ruleMap = buildRuleMap(dbRules);
        console.log(`[Scheduler] 📋 Rules loaded: ${dbRules.length} (${dbRules.filter((r: any) => r.enabled).length} enabled)`);




        // Parse postazioni from JSON string to array (same fix as in /api/staff)
        console.log(`🔧 Parsing staff postazioni...`);

        const normalize = (s: string) => {
            let norm = s.toLowerCase();
            norm = norm.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Accents
            norm = norm.replace(/_[0-9]+$/, ''); // _2
            norm = norm.replace(/_(s|v|d|l|m|me|g)$/, ''); // days
            norm = norm.replace(/:[a-z0-9]+$/, ''); // :s
            norm = norm.replace(/\s[0-9]+$/, ''); // " 2"
            norm = norm.replace(/\s[a-z]$/, ''); // " s"
            return norm.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '');
        };

        const staffList = staffListRaw.map(member => {
            let postazioni: string[] = [];
            try {
                if (typeof member.postazioni === 'string') {
                    if (member.postazioni.trim().startsWith('[')) {
                        postazioni = JSON.parse(member.postazioni);
                    } else if (member.postazioni.trim()) {
                        postazioni = member.postazioni.split(',').map((s: any) => s.trim()).filter((s: any) => !!s);
                    }
                } else if (Array.isArray(member.postazioni)) {
                    postazioni = member.postazioni;
                }
            } catch (error) {
                console.error(`⚠️ Error parsing postazioni for staff ${member.id} (${member.nome}):`, error);
                postazioni = [];
            }
            return { ...member, postazioni };
        });
        console.log(`✅ Parsed ${staffList.length} staff members`);

        // Load Constraints (Affinity/Blacklist)
        const constraints = await prisma.constraint.findMany({ where: { tenantKey } });
        const blacklistPairs: [number, number][] = [];

        constraints.forEach(c => {
            if (c.tipo === 'BLACKLIST') {
                try {
                    const pair = JSON.parse(c.valore); // Expect [id1, id2]
                    if (Array.isArray(pair) && pair.length === 2) blacklistPairs.push(pair as [number, number]);
                } catch { }
            }
        });

        // Track In-Memory State & Hours
        const memoryAssignments: Record<number, Record<string, { s: number, e: number, rawStart: string, rawEnd: string, station: string }[]>> = {};
        const staffHours: Record<number, number> = {};
        staffList.forEach(s => staffHours[s.id] = 0);

        // ── Build Competency Map ──
        // staffId -> postazione (normalized) -> score
        const competencyMap = new Map<number, Map<string, number>>();

        (staffCompetencies as any[]).forEach(comp => {
            if (!competencyMap.has(comp.staffId)) competencyMap.set(comp.staffId, new Map());
            const staffMap = competencyMap.get(comp.staffId)!;
            staffMap.set(normalize(comp.postazione), comp.score);
        });
        console.log(`✅ Built competency map for ${competencyMap.size} staff members`);

        // ── Build a covers-per-day map from budget rows ─────────────────────────────
        // Used by the Manager same-day constraint.
        const coversMap: Record<string, { lunch: number; dinner: number }> = {};
        for (const b of (budgetRows as any[])) {
            coversMap[b.data] = {
                lunch: (b.budgetCoversLunch ?? 0) + (b.realCoversLunch ?? 0),
                dinner: (b.budgetCoversDinner ?? 0) + (b.realCoversDinner ?? 0),
            };
        }

        // Helper: is this staff member a Manager?
        const isManager = (s: any): boolean => {
            const r = (s.ruolo ?? '').toLowerCase();
            return (
                r.includes('manager') || r.includes('direttore') || r.includes('titolare') ||
                r.includes('general') || r.includes('store') || r === 'rm' || r === 'vrm' ||
                r === 'dir' || r === 'vd' || r.includes('vice')
            );
        };

        // Manager cover threshold / exception day
        const MANAGER_DOUBLE_COVER_THRESHOLD = 180; // 180+ coperti
        const MANAGER_DOUBLE_DAY = 6;               // sabato (Saturday)


        // 1.5 Pre-Process Fixed Shifts & Permissions
        // ------------------------------------------

        const newAssignments: any[] = [];
        const unassigned: any[] = [];
        const lockedStaffDates = new Set<string>(); // "staffId:date"

        // 1.2 Process Training Data
        const patternMap = new Map<number, Map<number, Map<string, number>>>(); // StaffId -> DayOfWeek -> Station -> Count
        if (trainingDataRaw) {
            (trainingDataRaw as any[]).forEach((td: any) => {
                try {
                    const assignments = JSON.parse(td.data);
                    if (Array.isArray(assignments)) {
                        assignments.forEach((a: any) => {
                            if (!a.staffId || !a.data || !a.postazione) return;
                            const date = new Date(a.data);
                            const day = date.getDay();
                            const station = a.postazione.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

                            if (!patternMap.has(a.staffId)) patternMap.set(a.staffId, new Map());
                            const dayMap = patternMap.get(a.staffId)!;
                            if (!dayMap.has(day)) dayMap.set(day, new Map());
                            const stationMap = dayMap.get(day)!;

                            stationMap.set(station, (stationMap.get(station) || 0) + 1);
                        });
                    }
                } catch (e) { console.error('Error parsing training data', e); }
            });
            console.log(`🧠 AI Training Data Loaded: ${patternMap.size} staff patterns.`);
        }

        // Helper to lock
        const lockStaff = (sid: number, date: string) => lockedStaffDates.add(`${sid}:${date}`);
        const isLocked = (sid: number, date: string) => lockedStaffDates.has(`${sid}:${date}`);

        console.log(`[Scheduler] Start: ${startDate}, End: ${endDate}, Tenant: ${tenantKey}`);
        console.log(`[Scheduler] Loaded: Staff=${staffList.length}, Coverage=${coverageRows.length}, Existing=${existingAssignments.length}, Recurring=${recurringShifts.length}, Permissions=${approvedPermissions.length}`);

        // ... (rest of code)

        // A. Apply Fixed Shifts (EXCLUSIVE)
        let dLoop = new Date(startD);
        while (dLoop <= endD) {
            const dateStr = dLoop.toISOString().split('T')[0];
            const dayOfWeek = dLoop.getDay() || 7;

            const currentYear = dLoop.getFullYear();
            const currentWeek = getISOWeek(dLoop);

            console.log(`[Scheduler] Processing ${dateStr} (Week ${currentWeek}, Year ${currentYear}, Day ${dayOfWeek})`);

            staffList.forEach(staff => {
                // Find recurring shift
                const recurring = recurringShifts.find(r => {
                    if (r.staffId !== staff.id) return false;
                    if (r.dayOfWeek !== dayOfWeek) return false;

                    // Validity Check
                    let valid = true;
                    if (r.startYear && currentYear < r.startYear) valid = false;
                    if (r.endYear && currentYear > r.endYear) valid = false;
                    if (r.startWeek && currentWeek < r.startWeek) valid = false;
                    if (r.endWeek && currentWeek > r.endWeek) valid = false;

                    if (!valid) console.log(`[Scheduler] Skipped Fixed Shift for Staff ${staff.id} on ${dateStr} due to validity. Shift Range: W${r.startWeek}-${r.endWeek} Y${r.startYear}-${r.endYear}`);

                    return valid;
                });

                if (recurring && recurring.start_time && recurring.end_time) {
                    // CHECK STRICT LIMIT BEFORE APPLYING (With Tolerance)
                    // Calculate duration
                    const sM = toMinutes(recurring.start_time);
                    const eM = toMinutes(recurring.end_time);
                    let durMins = eM - sM;
                    if (durMins < 0) durMins += 1440;
                    const durHours = durMins / 60;

                    const TOLERANCE = 2.0; // Allow exceeding by 2h to avoid large under-assignment

                    if ((staffHours[staff.id] || 0) + durHours > (staff.oreMassime + TOLERANCE)) {
                        console.log(`[Scheduler] ⚠️ SKIPPED Fixed Shift for ${staff.nome} on ${dateStr}: Would exceed limit + tolerance (${staffHours[staff.id]} + ${durHours} > ${staff.oreMassime} + ${TOLERANCE})`);
                        unassigned.push({
                            date: dateStr,
                            start: recurring.start_time,
                            end: recurring.end_time,
                            station: recurring.postazione,
                            type: 'FIXED',
                            reason: `Limite Ore Superato (Fixed): ${staffHours[staff.id].toFixed(1)} + ${durHours.toFixed(1)} > ${staff.oreMassime} + ${TOLERANCE}`
                        });
                        return; // Skip this assignment
                    }

                    // APPLY EXCLUSIVELY
                    newAssignments.push({
                        staffId: staff.id,
                        data: dateStr,
                        start_time: recurring.start_time,
                        end_time: recurring.end_time,
                        postazione: recurring.postazione || 'Fixed', // Default if missing
                        shiftTemplateId: recurring.shiftTemplateId,
                        status: false,
                        tenantKey
                    });

                    // Update Memory
                    if (!memoryAssignments[staff.id]) memoryAssignments[staff.id] = {};
                    if (!memoryAssignments[staff.id][dateStr]) memoryAssignments[staff.id][dateStr] = [];
                    memoryAssignments[staff.id][dateStr].push({
                        s: toMinutes(recurring.start_time),
                        e: toMinutes(recurring.end_time) < toMinutes(recurring.start_time) ? toMinutes(recurring.end_time) + 1440 : toMinutes(recurring.end_time),
                        rawStart: recurring.start_time,
                        rawEnd: recurring.end_time,
                        station: recurring.postazione || 'Fixed'
                    });

                    // Update Hours
                    staffHours[staff.id] += durHours;

                    // LOCK THIS STAFF FOR THIS DATE
                    lockStaff(staff.id, dateStr);
                }
            });
            dLoop.setDate(dLoop.getDate() + 1);
        }

        // B. Apply Existing DB Assignments (Initial State) & Lock them if necessary?
        // Actually, getting schedule usually assumes generating FROM SCRATCH or filling gaps.
        // If we want to respectful of existing manual edits:
        existingAssignments.forEach(a => {
            if (!a.start_time || !a.end_time) return;
            if (!memoryAssignments[a.staffId]) memoryAssignments[a.staffId] = {};
            if (!memoryAssignments[a.staffId][a.data]) memoryAssignments[a.staffId][a.data] = [];
            // Only add if not already added by Fixed Logic (avoid dups if DB has them)
            // Checks logic omitted for brevity, assuming Generation clears range or we merge.
            // If we are appending, we need to check dupes.
            // For now, trust memoryAssignments.

            // Populate memory if not present (Fixed logic populated newAssignments, but we need memory for checks)
            // Double check existence?
            const exists = memoryAssignments[a.staffId][a.data].some(x => x.rawStart === a.start_time && x.rawEnd === a.end_time);
            if (!exists) {
                let durMins = toMinutes(a.end_time) - toMinutes(a.start_time);
                if (durMins < 0) durMins += 1440;

                memoryAssignments[a.staffId][a.data].push({
                    s: toMinutes(a.start_time),
                    e: toMinutes(a.end_time),
                    rawStart: a.start_time,
                    rawEnd: a.end_time,
                    station: a.postazione || 'Assigned'
                });
                // Also update hours from existing assignments (if they weren't cleared)
                // But since we usually clear, this might be redundant EXCEPT for manual locks or pre-existing
                // Since we cleared, existingAssignments should be empty for the range.
                // If checking cross-range (e.g. 11h rest from previous), existingAssignments covers previous days.
                // Those don't count towards CURRENT week total unless they fall in range.

                if (a.data >= startDate && a.data <= endDate) {
                    staffHours[a.staffId] = (staffHours[a.staffId] || 0) + (durMins / 60);
                }
            }
        });

        // Track Weekly Hours (Legacy init removed, used above)
        // const staffHours: Record<number, number> = {};
        // staffList.forEach(s => staffHours[s.id] = 0);

        // Check/Recalculate hours from Memory?
        // We already tracked them LIVE above for Fixed. 
        // And existingAssignments were added.
        // So staffHours is ready.

        // 2. Process Requirements

        // ----------------------
        // Flatten CoverageRows into discrete Shift Tasks
        type ShiftTask = {
            date: string;
            start: string;
            end: string;
            station: string;
            type: 'LUNCH' | 'DINNER';
        };

        const tasks: ShiftTask[] = [];

        console.log(`📋 Processing coverage rows into tasks...`);
        let curr = new Date(startD);
        while (curr <= endD) {
            const dateStr = curr.toISOString().split('T')[0];

            // Find rows for this week
            // (Simplified matching: check weekStart. In production, exact week logic required)
            const activeRows = coverageRows.filter(r => {
                // Check if dateStr roughly falls in r.weekStart week.
                // For safety, we trust the Query logic or check explicitly.
                // Let's assume passed rows are relevant.
                // Check if JSON has slot for this date.
                try {
                    if (!r.slots) return false;
                    const slots = JSON.parse(r.slots);
                    return !!slots[dateStr];
                } catch (error) {
                    console.error(`⚠️ Error parsing slots for coverageRow ${r.id}:`, error);
                    return false;
                }
            });

            for (const row of activeRows) {
                try {
                    const slots = JSON.parse(row.slots);
                    const day = slots[dateStr];
                    if (!day) continue;

                    // Active check
                    let isActive = true;
                    try {
                        if (row.extra) {
                            const extra = JSON.parse(row.extra);
                            if (extra.active === false) isActive = false;
                        }
                    } catch (e) {
                        console.error(`⚠️ Error parsing extra for coverageRow ${row.id}:`, e);
                    }
                    if (!isActive) continue;

                    if (day.lIn && day.lOut) tasks.push({ date: dateStr, start: day.lIn, end: day.lOut, station: row.station, type: 'LUNCH' });
                    if (day.dIn && day.dOut) tasks.push({ date: dateStr, start: day.dIn, end: day.dOut, station: row.station, type: 'DINNER' });
                } catch (error) {
                    console.error(`⚠️ Error processing coverageRow ${row.id} for date ${dateStr}:`, error);
                }
            }

            // Exclude MANAGER from auto-scheduling tasks
            // We filter the tasks array in place or after loop
            curr.setDate(curr.getDate() + 1);
        }

        // Filter out MANAGER tasks
        for (let i = tasks.length - 1; i >= 0; i--) {
            if (tasks[i].station.toUpperCase() === 'MANAGER') {
                tasks.splice(i, 1);
            }
        }

        // Sort tasks Chronologically
        tasks.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return toMinutes(a.start) - toMinutes(b.start);
        });

        // CRITICAL FIX: Deduplicate tasks to prevent duplicate station assignments
        // If multiple coverageRows exist for same station, we get duplicate tasks
        const uniqueTasks: ShiftTask[] = [];
        const taskKeys = new Set<string>();

        for (const task of tasks) {
            const key = `${task.date}|${task.start}|${task.end}|${task.station}|${task.type}`;
            if (!taskKeys.has(key)) {
                taskKeys.add(key);
                uniqueTasks.push(task);
            } else {
                console.log(`[Scheduler] ⚠️ Skipped duplicate task: ${task.station} on ${task.date} ${task.start}-${task.end}`);
            }
        }

        console.log(`[Scheduler] Tasks: ${tasks.length} total, ${uniqueTasks.length} unique (removed ${tasks.length - uniqueTasks.length} duplicates)`);

        // Group by (Date + ShiftType) to handle "Batch" constraints (like distribution of Seniors)
        // Actually, we process task by task for simplicity, but "Senior per Role" means per *Role* per Shift.
        // We can just try to fill tasks.

        // const newAssignments: any[] = [];

        // FILTER: Remove tasks already covered by Existing Assignments (Manual)
        const finalTasks = uniqueTasks.filter(task => {
            const tS = toMinutes(task.start);
            const tE = toMinutes(task.end);
            let tE_adj = tE;
            if (tE < tS) tE_adj += 1440;

            // Normalize helper (duplicated for scope)
            const normalize = (s: string) => {
                let norm = s.toLowerCase();
                // Handle accents
                norm = norm.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                // Remove numeric suffixes: _2, _3, etc.
                norm = norm.replace(/_[0-9]+$/, '');
                // Remove day suffixes: _s, _v, _d (sabato, venerdi, domenica)
                norm = norm.replace(/_(s|v|d|l|m|me|g)$/, '');
                // Remove colon suffixes: :s, :v, etc.
                norm = norm.replace(/:[a-z0-9]+$/, '');
                // DO NOT remove important keywords like 'sala', 'cucina', 'bar'
                // Only remove single-letter or numeric suffixes after space
                norm = norm.replace(/\s[0-9]+$/, '');
                norm = norm.replace(/\s[a-z]$/, '');

                return norm.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '');
            };

            const taskStationNorm = normalize(task.station);

            // Check if any existing assignment covers this task
            // We check Manual assignments AND Fixed shifts (which are now in newAssignments up to this point?)
            // Actually, Fixed Shifts are processed in step A and added to `newAssignments` but NOT `existingAssignments` presumably?
            // Wait, existingAssignments comes from DB. Fixed shifts are added to `newAssignments`.
            // We need to check BOTH.

            const allCovering = [...existingAssignments, ...newAssignments];

            const isCovered = allCovering.some(a => {
                if (a.data !== task.date) return false;
                if (!a.postazione) return false;

                // Check station match
                if (normalize(a.postazione) !== taskStationNorm) return false;

                // Check time overlap
                const aS = toMinutes(a.start_time || a.shiftTemplate?.oraInizio || '00:00');
                const aE = toMinutes(a.end_time || a.shiftTemplate?.oraFine || '00:00');
                let aE_adj = aE;
                if (aE < aS) aE_adj += 1440;

                // Strict overlap check: (Start A < End B) and (End A > Start B)
                return (aS < tE_adj && aE_adj > tS);
            });

            if (isCovered) {
                console.log(`[Scheduler] ⏭️ Task skipped because already covered: ${task.station} on ${task.date}`);
                return false;
            }
            return true;
        });


        // ── PIT & Day Priority: Re-sort finalTasks ───────────────────────────────────
        // We prioritize weekends (highest volume/importance) and high PIT intensity.
        // Day Priority: Sat(6), Sun(0), Fri(5) are top priority.
        const dayPriority: Record<number, number> = {
            6: 0, // Saturday (highest)
            0: 1, // Sunday
            5: 2, // Friday
            4: 3, // Thursday
            3: 4, // Wednesday
            2: 5, // Tuesday
            1: 6, // Monday (lowest)
        };

        finalTasks.sort((a, b) => {
            const dayA = new Date(a.date).getDay();
            const dayB = new Date(b.date).getDay();

            // 1. Priority by Day of week
            if (dayPriority[dayA] !== dayPriority[dayB]) {
                return (dayPriority[dayA] ?? 99) - (dayPriority[dayB] ?? 99);
            }

            // 2. Priority by PIT (Intensity)
            const pitA = calculatePIT({
                shiftType: a.type === 'DINNER' ? 'SERA' : 'PRANZO',
                dayOfWeek: dayA,
                covers: 0,
            });
            const pitB = calculatePIT({
                shiftType: b.type === 'DINNER' ? 'SERA' : 'PRANZO',
                dayOfWeek: dayB,
                covers: 0,
            });

            if (pitB !== pitA) return pitB - pitA;

            // 3. Chronological
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return toMinutes(a.start) - toMinutes(b.start);
        });
        console.log(`[Scheduler] ⚡ Tasks sorted by PIT (highest first). Top slot: ${finalTasks[0]?.station} ${finalTasks[0]?.date} ${finalTasks[0]?.type}`);

        console.log(`[Scheduler] Processing ${finalTasks.length} tasks (skipped ${uniqueTasks.length - finalTasks.length} covered manually)`);

        for (const task of finalTasks) {
            // 3. Score Candidates
            // ------------------

            // ── ACC vs ACC GIU Mutual Exclusivity ──
            const tSN = normalize(task.station);
            const isACC = tSN === 'acc';
            const isACCGIU = tSN === 'accgiu';

            if (isACC || isACCGIU) {
                const rival = isACC ? 'accgiu' : 'acc';
                const sM_task = toMinutes(task.start);
                const eM_task = toMinutes(task.end);

                // Check ALL staff assignments for overlap with rival station
                let conflict = false;
                for (const daysMap of Object.values(memoryAssignments)) {
                    const shifts = daysMap[task.date] || [];
                    if (shifts.some(sh => normalize(sh.station) === rival && (sM_task < sh.e && eM_task > sh.s))) {
                        conflict = true;
                        break;
                    }
                }
                if (conflict) {
                    console.log(`[Scheduler] 🚫 Mutual Exclusivity: Skipping ${task.station} task on ${task.date} because ${rival} is already occupied.`);
                    continue; // Skip the entire task
                }
            }

            // Filter potential staff
            let candidates = staffList.filter(s => {
                // b. Locked Check (Fixed Shift Exclusivity)
                if (isLocked(s.id, task.date)) return false;

                // Exclude "Supporto Navigli" from auto-assignment (Manual Only)
                const isSupportoNavigli =
                    s.nome.toLowerCase().includes('supporto navigli') ||
                    s.nome.toLowerCase().includes('supporto') && s.nome.toLowerCase().includes('navigli') ||
                    (s.ruolo || '').toLowerCase().includes('supporto navigli');
                if (isSupportoNavigli) return false;


                const taskStationNorm = normalize(task.station);

                // --- SKILL FILTER (Rating check) ---
                const skillParams = getRuleParams(ruleMap, 'SKILL_FILTER', { minScoreToWork: 2, scoreBonus4: 60, scoreBonus5: 120 });
                if (ruleEnabled(ruleMap, 'SKILL_FILTER')) {
                    const skillScore = competencyMap.get(s.id)?.get(taskStationNorm) ?? 3; // Default 3 if record missing
                    if (skillScore < skillParams.minScoreToWork) {
                        console.log(`[Scheduler] ⛔ Skill block: ${s.nome} score=${skillScore} < ${skillParams.minScoreToWork} for ${task.station}`);
                        return false;
                    }
                }

                // Ensure staff has this station in their list (fuzzy prefix match)
                const hasStation = (s.postazioni as string[]).some((p: string) => {
                    const pn = normalize(p);
                    return pn === taskStationNorm
                        || pn.startsWith(taskStationNorm)
                        || taskStationNorm.startsWith(pn);
                });
                if (!hasStation) return false;

                // d. Department Compatibility Check (SALA vs CUCINA)
                // Prevent cross-department assignments (e.g., SALA staff cannot work CUCINA positions)
                const canWork = canStaffWorkStation(s.postazioni, task.station);
                if (!canWork) {
                    console.log(`[Scheduler] ⚠️ Blocked ${s.nome} for ${task.station}: Department mismatch (staff has ${s.postazioni.join(', ')})`);
                    return false;
                }

                // e. Availability & Permissions (Strict)
                const sM = toMinutes(task.start);
                const eM = toMinutes(task.end);

                // i. Check Unavailabilities
                const isUnav = (s as any).unavailabilities.some((u: any) => {
                    if (u.data !== task.date) return false;
                    const typeMatches = ['TOTALE', 'FERIE', 'MALATTIA', 'PERMESSO'].includes(u.tipo); // Added PERMESSO just in case
                    if (typeMatches) {
                        console.log(`[Scheduler] Blocked ${s.nome} on ${task.date}: Type ${u.tipo}`);
                        return true;
                    }
                    if (u.start_time && u.end_time) {
                        const uS = toMinutes(u.start_time);
                        const uE = toMinutes(u.end_time);
                        const overlaps = (sM < uE && eM > uS);
                        if (overlaps) console.log(`[Scheduler] Blocked ${s.nome} on ${task.date}: Overlap ${u.start_time}-${u.end_time} with Task ${task.start}-${task.end}`);
                        return overlaps;
                    }
                    return false;
                });
                if (isUnav) return false;

                // ii. Check Permission Requests
                if (ruleEnabled(ruleMap, 'PERMISSIONS')) {
                    const hasPermission = approvedPermissions.some(p => {
                        if (p.staffId !== s.id) return false;
                        if (p.data !== task.date) return false;
                        if (p.startTime && p.endTime) {
                            const pS = toMinutes(p.startTime);
                            const pE = toMinutes(p.endTime);
                            return (sM < pE && eM > pS);
                        }
                        return true;
                    });
                    if (hasPermission) return false;
                }


                // e. Occupancy (Strict: ONE SHIFT PER DAY)
                if (ruleEnabled(ruleMap, 'ONE_SHIFT_PER_DAY')) {
                    const worked = memoryAssignments[s.id]?.[task.date] || [];
                    if (worked.length > 0) return false;
                }

                // f. Rest Hours Rule
                if (ruleEnabled(ruleMap, 'REST_HOURS')) {
                    const { hours: restH } = getRuleParams(ruleMap, 'REST_HOURS', { hours: 11 });
                    const restMinutes = restH * 60;
                    const prevDate2 = new Date(task.date);
                    prevDate2.setDate(prevDate2.getDate() - 1);
                    const prevDateStr = prevDate2.toISOString().split('T')[0];
                    const prevShifts = memoryAssignments[s.id]?.[prevDateStr] || [];
                    if (prevShifts.length > 0) {
                        const lateShift = _.maxBy(prevShifts, 'e');
                        if (lateShift) {
                            const prevEndAbs = lateShift.e;
                            const currStartAbs = sM + 1440;
                            if (currStartAbs - prevEndAbs < restMinutes) return false;
                        }
                    }
                }

                // g. Max Hours Check (Strict)
                if (ruleEnabled(ruleMap, 'MAX_HOURS')) {
                    let shiftDurationMins = eM - sM;
                    if (shiftDurationMins < 0) shiftDurationMins += 1440;
                    const shiftDurationHours = shiftDurationMins / 60;
                    const currentHours = staffHours[s.id] || 0;
                    if (currentHours + shiftDurationHours > s.oreMassime) return false;
                }

                return true;
            });

            // ── Fallback logic: if we have staff with score >= 3, remove those with score = 2 ──
            if (ruleEnabled(ruleMap, 'SKILL_FILTER')) {
                const tSN = normalize(task.station);
                const hasSolidCandidates = candidates.some(s => (competencyMap.get(s.id)?.get(tSN) ?? 3) >= 3);
                if (hasSolidCandidates) {
                    candidates = candidates.filter(s => (competencyMap.get(s.id)?.get(tSN) ?? 3) >= 3);
                }
            }

            // f. Blacklist Check
            // We look at who is ALREADY assigned to this [Date, ShiftType] (roughly overlapping).
            // Find all staff currently working in this time slot
            const concurrentStaffIds = new Set<number>();
            for (const [sid, daysMap] of Object.entries(memoryAssignments)) {
                const shifts = daysMap[task.date] || [];
                const overlaps = shifts.some(w => {
                    // Fix overlap check for overnight?
                    // Simple overlap: StartA < EndB && EndA > StartB
                    // If shifts wrap, it's complex. Assuming standard day shifts or consistent encoding.
                    // For safety: if w spans midnight, it might be stored as two chunks or handled by date.
                    // Given current simple logic, assume standard day overlap check is enough for now, 
                    // but `toMinutes` issue applies here too if w.e < w.s
                    // Let's rely on tasks being sorted and simple.
                    return (toMinutes(task.start) < w.e && toMinutes(task.end) > w.s);
                });
                if (overlaps) concurrentStaffIds.add(Number(sid));
            }

            if (ruleEnabled(ruleMap, 'BLACKLIST_RESPECT')) {
                candidates = candidates.filter(s => {
                    for (const partnerId of concurrentStaffIds) {
                        const isBad = blacklistPairs.some(p => (p[0] === s.id && p[1] === partnerId) || (p[1] === s.id && p[0] === partnerId));
                        if (isBad) return false;
                    }
                    if (s.incompatibilityId) {
                        const clash = staffList.find(c => concurrentStaffIds.has(c.id) && c.incompatibilityId === s.incompatibilityId);
                        if (clash) return false;
                    }
                    return true;
                });
            }

            // ── Manager same-day constraint ─────────────────────────────────────────────
            if (ruleEnabled(ruleMap, 'MANAGER_SAME_DAY')) {
                const { max: maxManagers, coversThreshold } = getRuleParams(ruleMap, 'MANAGER_SAME_DAY', { max: 1, coversThreshold: 180 });
                const taskCovers = task.type === 'DINNER'
                    ? (coversMap[task.date]?.dinner ?? 0)
                    : (coversMap[task.date]?.lunch ?? 0);
                const isHighTrafficException = taskCovers >= coversThreshold;

                if (!isHighTrafficException) {
                    const managersAlreadyOnShift = [
                        ...newAssignments.filter(a => a.data === task.date),
                        ...existingAssignments.filter(a => a.data === task.date),
                    ].filter(a => {
                        const staffMember = staffList.find(st => st.id === a.staffId);
                        return staffMember && isManager(staffMember);
                    });

                    if (managersAlreadyOnShift.length >= maxManagers) {
                        const assignedManagerIds = new Set(managersAlreadyOnShift.map(a => a.staffId));
                        candidates = candidates.filter(s => {
                            if (isManager(s) && !assignedManagerIds.has(s.id)) {
                                console.log(`[Scheduler] 🚫 Manager rule: blocked ${s.nome} on ${task.date}`);
                                return false;
                            }
                            return true;
                        });
                    }
                } else {
                    console.log(`[Scheduler] ✅ High traffic exception: double manager ok on ${task.date} (${taskCovers} coperti)`);
                }
            }

            // 4. Scoring / Selection
            // ---------------------
            // We need to select 1 person for this task.

            // Shuffle first for randomness
            candidates = _.shuffle(candidates);

            // Heuristic: Prefer SENIOR if we need coverage?
            // "Algorithm guarantees at least one Senior per role".
            // We check if a Senior is ALREADY assigned to this slot/role.
            // If NOT, we prioritize Seniors.

            const roleAssignedStaffIds = Array.from(concurrentStaffIds).filter(sid => {
                // Check if they are working the SAME STATION/ROLE
                // Not easy to know exact role of concurrent assignment without storing it.
                // We can check memoryAssignments but we didn't store Station there.
                // Let's approximate: If someone is working, assume they cover their role.
                // Better: We track assignments with metadata.
                return true;
            });

            // ── PIT Score for this task ──────────────────────────────────────────────────
            const taskDayOfWeek = new Date(task.date).getDay();
            const taskPIT = calculatePIT({
                shiftType: task.type === 'DINNER' ? 'SERA' : 'PRANZO',
                dayOfWeek: taskDayOfWeek,
                covers: 0,
            });
            const isHighPITSlot = taskPIT >= PIT_THRESHOLDS.MEDIUM; // PIT ≥ 3.5

            // Compute current senior ratio for this slot (date × shift-type)
            // to enforce minimum 40% Senior presidio on high-PIT slots
            const slotSeniorCount = Array.from(concurrentStaffIds).filter(sid => {
                const s = staffList.find(st => st.id === sid);
                return s ? isPITSenior(s.ruolo ?? '', s.skillLevel ?? '') : false;
            }).length;
            const slotTotalCount = concurrentStaffIds.size;
            const currentSeniorRatio = slotTotalCount > 0 ? slotSeniorCount / slotTotalCount : 1;
            const needsSenior = isHighPITSlot && currentSeniorRatio < 0.40;

            candidates.sort((a, b) => {
                let scoreA = 0;
                let scoreB = 0;

                // Factor 1: Weekly Hours (balance)
                // Lower is better.
                scoreA -= (staffHours[a.id] || 0);
                scoreB -= (staffHours[b.id] || 0);

                // Factor 2: PIT-Weighted Seniority Boost
                // The higher the PIT, the more we reward assigning a Senior.
                // Senior bonus is now much more aggressive on high-intensity slots.
                const seniorA = isPITSenior(a.ruolo ?? '', a.skillLevel ?? '');
                const seniorB = isPITSenior(b.ruolo ?? '', b.skillLevel ?? '');

                // Base senior bonus
                const baseSeniorBonus = 50;
                // Intensity-specific bonus: (PIT^2) * multiplier to make it exponential
                const intensityBonus = isHighPITSlot ? (taskPIT * taskPIT * 15) : (taskPIT * 5);

                if (seniorA) scoreA += baseSeniorBonus + intensityBonus;
                if (seniorB) scoreB += baseSeniorBonus + intensityBonus;

                // Factor 2b: Hard preference — if this slot urgently needs a Senior (< 40% ratio),
                // give Seniors an additional emergency boost so they dominate the sort
                if (needsSenior) {
                    if (seniorA) scoreA += 500; // Increased emergency boost
                    if (seniorB) scoreB += 500;
                }

                // Factor 2c: Competency Rating Bonus
                if (ruleEnabled(ruleMap, 'SKILL_FILTER')) {
                    const skillParams = getRuleParams(ruleMap, 'SKILL_FILTER', { minScoreToWork: 2, scoreBonus4: 60, scoreBonus5: 120 });
                    const tSN = normalize(task.station);

                    const sA = competencyMap.get(a.id)?.get(tSN) ?? 3;
                    const sB = competencyMap.get(b.id)?.get(tSN) ?? 3;

                    if (sA === 4) scoreA += skillParams.scoreBonus4;
                    if (sA === 5) scoreA += skillParams.scoreBonus4 + skillParams.scoreBonus5; // Cumulative
                    if (sB === 4) scoreB += skillParams.scoreBonus4;
                    if (sB === 5) scoreB += skillParams.scoreBonus4 + skillParams.scoreBonus5;
                }

                // Factor 3: AI Pattern Matching
                const dayOfWeek = taskDayOfWeek;
                const taskStationNormSort = normalize(task.station);

                const getPatternScore = (sid: number) => {
                    const sMap = patternMap.get(sid)?.get(dayOfWeek);
                    if (!sMap) return 0;
                    return sMap.get(taskStationNormSort) || 0;
                };

                const patA = getPatternScore(a.id);
                const patB = getPatternScore(b.id);

                scoreA += patA * 20;
                scoreB += patB * 20;

                // Factor 4: Sequence Comfort (Anti-Clopening)
                // Penalize Early Start after Late Finish (even if legal >11h)
                const isClopening = (sid: number) => {
                    const prevD = new Date(task.date);
                    prevD.setDate(prevD.getDate() - 1);
                    const pDateStr = prevD.toISOString().split('T')[0];
                    const pShifts = memoryAssignments[sid]?.[pDateStr] || [];
                    const lateShift = pShifts.find(s => s.e > (22 * 60));
                    const tStart = toMinutes(task.start);
                    if (lateShift && tStart < (10 * 60)) return true;
                    return false;
                };

                if (isClopening(a.id)) scoreA -= 500;
                if (isClopening(b.id)) scoreB -= 500;

                // Factor 5: Equity / Fairness (PIT-Aware Weekend Rotation)
                // On weekend slots: penalize staff with many past weekends.
                // For SENIOR staff: also apply consecutive-weekend cap (max 2 in a row).
                if (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) {
                    const getWeekendCount = (sid: number) => {
                        let count = 0;
                        const cutoff = new Date(startDate);
                        if (memoryAssignments[sid]) {
                            Object.keys(memoryAssignments[sid]).forEach(dStr => {
                                const d = new Date(dStr);
                                if (d < cutoff) {
                                    const dDay = d.getDay();
                                    if (dDay === 0 || dDay === 5 || dDay === 6) count++;
                                }
                            });
                        }
                        return count;
                    };

                    const wA = getWeekendCount(a.id);
                    const wB = getWeekendCount(b.id);

                    // Base penalty: -30 per past weekend shift
                    scoreA -= wA * 30;
                    scoreB -= wB * 30;

                    // Senior consecutive weekend cap: soft penalty if > MAX_CONSECUTIVE_WEEKENDS
                    // (allows overrides if no other Senior available)
                    if (seniorA && wA > MAX_CONSECUTIVE_WEEKENDS * 2) scoreA -= 200;
                    if (seniorB && wB > MAX_CONSECUTIVE_WEEKENDS * 2) scoreB -= 200;
                }

                // ── MOUSSA RULE: 75% SERA + Weekend priority + No Mon/Tue ──────────────
                // Moussa al pass is stronger on evening service → prefer SERA shifts,
                // especially on weekends; avoid assigning at the start of the week.
                const isMoussa = (s: any) =>
                    ((s.nome || '').toLowerCase().includes('moussa') &&
                        (s.nome || '').toLowerCase().includes('bance')) ||
                    ((s.nome || '').toLowerCase().includes('moussa') &&
                        (s.postazioni || []).some((p: string) => p.toLowerCase().includes('pass')));

                // Day-of-week: 1=Mon, 2=Tue, 6=Sat, 0=Sun, 5=Fri
                const taskDow = taskDayOfWeek; // already computed above
                const isWeekendDay = taskDow === 0 || taskDow === 5 || taskDow === 6;
                const isWeekStart = taskDow === 1 || taskDow === 2; // Mon, Tue
                const isDinnerSlot = task.type === 'DINNER';

                const moussaMinSkill = 3;
                const tSN = normalize(task.station);

                if (isMoussa(a) && (competencyMap.get(a.id)?.get(tSN) ?? 3) >= moussaMinSkill) {
                    if (isDinnerSlot) scoreA += 400;              // Strong preference for SERA
                    if (isDinnerSlot && isWeekendDay) scoreA += 200; // Priority on weekend SERA
                    if (!isDinnerSlot) scoreA -= 200;             // Penalize PRANZO
                    if (isWeekStart) scoreA -= 800;               // Avoid Mon/Tue
                }
                if (isMoussa(b) && (competencyMap.get(b.id)?.get(tSN) ?? 3) >= moussaMinSkill) {
                    if (isDinnerSlot) scoreB += 400;
                    if (isDinnerSlot && isWeekendDay) scoreB += 200;
                    if (!isDinnerSlot) scoreB -= 200;
                    if (isWeekStart) scoreB -= 800;
                }

                return scoreB - scoreA; // Descending
            });

            // Pick top
            const best = candidates[0];

            if (best) {
                // Assign
                newAssignments.push({
                    staffId: best.id,
                    data: task.date,
                    start_time: task.start,
                    end_time: task.end,
                    postazione: task.station,
                    status: false,
                    tenantKey
                });

                // Update Memory
                let durMins = toMinutes(task.end) - toMinutes(task.start);
                if (durMins < 0) durMins += 1440;

                if (!memoryAssignments[best.id]) memoryAssignments[best.id] = {};
                if (!memoryAssignments[best.id][task.date]) memoryAssignments[best.id][task.date] = [];
                memoryAssignments[best.id][task.date].push({
                    s: toMinutes(task.start),
                    e: toMinutes(task.end),
                    rawStart: task.start,
                    rawEnd: task.end,
                    station: task.station
                });

                // Update Hours
                staffHours[best.id] = (staffHours[best.id] || 0) + (durMins / 60);
            } else {
                // No candidate found!
                // Aggregate reasons from the tracking done during filtering
                // We need to re-run the filter logic or refactor to track it.
                // Refactoring the filter to a loop is better.

                const failStats: Record<string, number> = {
                    'Locked': 0, 'Skill': 0, 'Dept': 0, 'Unav': 0, 'Perm': 0, 'Occupied': 0, 'Rest': 0, 'MaxHours': 0, 'Blacklist': 0, 'Incompat': 0
                };

                // Quick re-check to generate stats (or we could have done it in the main loop, but filter is cleaner)
                // We'll do a quick pass here since we failed anyway.
                staffList.forEach(s => {
                    if (isLocked(s.id, task.date)) { failStats['Locked']++; return; }

                    const normalize = (val: string) => val.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const taskStationNorm = normalize(task.station);
                    const hasStation = (s.postazioni as string[]).some((p: string) => normalize(p) === taskStationNorm);
                    if (!hasStation) { failStats['Skill']++; return; }

                    if (!canStaffWorkStation(s.postazioni, task.station)) { failStats['Dept']++; return; }

                    // Availability
                    const sM = toMinutes(task.start);
                    const eM = toMinutes(task.end);
                    const isUnav = s.unavailabilities.some((u: any) => {
                        if (u.data !== task.date) return false;
                        if (['TOTALE', 'FERIE', 'MALATTIA', 'PERMESSO'].includes(u.tipo)) return true;
                        if (u.start_time && u.end_time) {
                            const uS = toMinutes(u.start_time);
                            const uE = toMinutes(u.end_time);
                            return (sM < uE && eM > uS);
                        }
                        return false;
                    });
                    if (isUnav) { failStats['Unav']++; return; }

                    // Permissions
                    const hasPerm = approvedPermissions.some(p => {
                        if (p.staffId !== s.id || p.data !== task.date) return false;
                        if (p.startTime && p.endTime) {
                            const pS = toMinutes(p.startTime);
                            const pE = toMinutes(p.endTime);
                            return (sM < pE && eM > pS);
                        }
                        return true;
                    });
                    if (hasPerm) { failStats['Perm']++; return; }

                    // Occupancy
                    const worked = memoryAssignments[s.id]?.[task.date] || [];
                    if (worked.some(w => (sM < w.e && eM > w.s))) { failStats['Occupied']++; return; }

                    // Rest
                    const prevDate = new Date(task.date);
                    prevDate.setDate(prevDate.getDate() - 1);
                    const prevDateStr = prevDate.toISOString().split('T')[0];
                    const prevShifts = memoryAssignments[s.id]?.[prevDateStr] || [];
                    if (prevShifts.length > 0) {
                        const lateShift = _.maxBy(prevShifts, 'e');
                        if (lateShift) {
                            const prevEndAbs = lateShift.e;
                            const currStartAbs = sM + 1440;
                            if (currStartAbs - prevEndAbs < 660) { failStats['Rest']++; return; }
                        }
                    }

                    // Max Hours
                    let dur = eM - sM;
                    if (dur < 0) dur += 1440;
                    if ((staffHours[s.id] || 0) + (dur / 60) > s.oreMassime) { failStats['MaxHours']++; return; }

                    // Blacklist/Incompat (simplified)
                    // ... (skipping complex check for brevity in stats)
                });

                // Format reason string
                const reasons = Object.entries(failStats)
                    .filter(([_, count]) => count > 0)
                    .map(([k, c]) => `${k}:${c}`)
                    .join(', ');

                console.log(`[Scheduler] ⚠️ UNASSIGNED: ${task.date} ${task.start}-${task.end} ${task.station}. Reasons: ${reasons}`);
                unassigned.push({
                    date: task.date,
                    start: task.start,
                    end: task.end,
                    station: task.station,
                    type: task.type,
                    reason: `Nessun candidato. Rifiuti: ${reasons || 'Blacklist/Altro'}`
                });
            }
        }

        // 2.5 ADD REASONING LOGIC (OPTIONAL SECOND PASS OR JUST MODIFY FILTER ABOVE)
        // To properly "Debug" this, we should change the filter to map candidates to results.
        // However, I will stick to the requested change of just providing better output if possible, 
        // but without rewriting the whole loop in this specific Replace block.
        // The user wants to RESOLVE conflicts.

        console.log(`[Scheduler] Complete. Assigned: ${newAssignments.length}, Unassigned: ${unassigned.length}`);
        console.log(`=== SCHEDULE GENERATION END ===\n`);
        return { assignments: newAssignments, unassigned };

    } catch (error: any) {
        console.error(`\n❌ === SCHEDULE GENERATION ERROR ===`);
        console.error(`Error Type: ${error.constructor.name}`);
        console.error(`Error Message: ${error.message}`);
        console.error(`Stack Trace:`, error.stack);
        console.error(`===================================\n`);
        throw error; // Re-throw to be caught by the route handler
    }
}

export async function auditSchedule(startDate: string, endDate: string, tenantKey: string) {
>>>>>>> Stashed changes
    const startD = new Date(startDate);
    const endD = new Date(endDate);

    // Buffer for 11h rest check (need shifts from previous day)
    const queryStart = new Date(startD);
    queryStart.setDate(queryStart.getDate() - 2);

    const [staffListRaw, coverageRows, existingAssignments, recurringShifts, approvedPermissions] = await Promise.all([
        prisma.staff.findMany({
            where: { tenantKey },
            include: { unavailabilities: true }
        }),
        prisma.coverageRow.findMany({
            where: {
                tenantKey,
                weekStart: {
                    gte: queryStart.toISOString().split('T')[0],
                    lte: endDate
                }
            }
        }),
        prisma.assignment.findMany({
            where: {
                tenantKey,
                data: { gte: queryStart.toISOString().split('T')[0] }
            }
        }),
        prisma.recurringShift.findMany({
            where: { tenantKey }
        }),
        prisma.permissionRequest.findMany({
            where: {
                Staff: { tenantKey },
                status: 'APPROVED',
                data: { gte: queryStart.toISOString().split('T')[0], lte: endDate }
            }
        })
    ]);

    // Parse postazioni from JSON string to array (same fix as in /api/staff)
    const staffList = staffListRaw.map(member => {
        let postazioni: string[] = [];
        try {
            if (typeof member.postazioni === 'string') {
                if (member.postazioni.trim().startsWith('[')) {
                    postazioni = JSON.parse(member.postazioni);
                } else if (member.postazioni.trim()) {
                    postazioni = member.postazioni.split(',').map(s => s.trim()).filter(s => s);
                }
            } else if (Array.isArray(member.postazioni)) {
                postazioni = member.postazioni;
            }
        } catch (error) {
            console.error(`⚠️ Error parsing postazioni for staff ${member.id}:`, error);
            postazioni = [];
        }
        return { ...member, postazioni };
    });

    // Load Constraints (Affinity/Blacklist)
    const constraints = await prisma.constraint.findMany({ where: { tenantKey } });
    const blacklistPairs: [number, number][] = [];

    constraints.forEach(c => {
        if (c.tipo === 'BLACKLIST') {
            try {
                const pair = JSON.parse(c.valore); // Expect [id1, id2]
                if (Array.isArray(pair) && pair.length === 2) blacklistPairs.push(pair as [number, number]);
            } catch { }
        }
    });

    // Track In-Memory State
    const memoryAssignments: Record<number, Record<string, { s: number, e: number, rawStart: string, rawEnd: string }[]>> = {};

    // 1.5 Pre-Process Fixed Shifts & Permissions
    // ------------------------------------------

    const newAssignments: any[] = [];
    const unassigned: any[] = [];
    const lockedStaffDates = new Set<string>(); // "staffId:date"

    // Helper to lock
    const lockStaff = (sid: number, date: string) => lockedStaffDates.add(`${sid}:${date}`);
    const isLocked = (sid: number, date: string) => lockedStaffDates.has(`${sid}:${date}`);

    console.log(`[Scheduler] Start: ${startDate}, End: ${endDate}, Tenant: ${tenantKey}`);
    console.log(`[Scheduler] Loaded: Staff=${staffList.length}, Coverage=${coverageRows.length}, Existing=${existingAssignments.length}, Recurring=${recurringShifts.length}, Permissions=${approvedPermissions.length}`);

    // ... (rest of code)

    // A. Apply Fixed Shifts (EXCLUSIVE)
    let dLoop = new Date(startD);
    while (dLoop <= endD) {
        const dateStr = dLoop.toISOString().split('T')[0];
        const dayOfWeek = dLoop.getDay() || 7;

        const currentYear = dLoop.getFullYear();
        const currentWeek = getISOWeek(dLoop);

        console.log(`[Scheduler] Processing ${dateStr} (Week ${currentWeek}, Year ${currentYear}, Day ${dayOfWeek})`);

        staffList.forEach(staff => {
            // Find recurring shift
            const recurring = recurringShifts.find(r => {
                if (r.staffId !== staff.id) return false;
                if (r.dayOfWeek !== dayOfWeek) return false;

                // Validity Check
                let valid = true;
                if (r.startYear && currentYear < r.startYear) valid = false;
                if (r.endYear && currentYear > r.endYear) valid = false;
                if (r.startWeek && currentWeek < r.startWeek) valid = false;
                if (r.endWeek && currentWeek > r.endWeek) valid = false;

                if (!valid) console.log(`[Scheduler] Skipped Fixed Shift for Staff ${staff.id} on ${dateStr} due to validity. Shift Range: W${r.startWeek}-${r.endWeek} Y${r.startYear}-${r.endYear}`);

                return valid;
            });

            if (recurring && recurring.start_time && recurring.end_time) {
                // APPLY EXCLUSIVELY
                newAssignments.push({
                    staffId: staff.id,
                    data: dateStr,
                    start_time: recurring.start_time,
                    end_time: recurring.end_time,
                    postazione: recurring.postazione || 'Fixed', // Default if missing
                    shiftTemplateId: recurring.shiftTemplateId,
                    status: false,
                    tenantKey
                });

                // Update Memory
                if (!memoryAssignments[staff.id]) memoryAssignments[staff.id] = {};
                if (!memoryAssignments[staff.id][dateStr]) memoryAssignments[staff.id][dateStr] = [];
                memoryAssignments[staff.id][dateStr].push({
                    s: toMinutes(recurring.start_time),
                    e: toMinutes(recurring.end_time) < toMinutes(recurring.start_time) ? toMinutes(recurring.end_time) + 1440 : toMinutes(recurring.end_time),
                    rawStart: recurring.start_time,
                    rawEnd: recurring.end_time
                });

                // LOCK THIS STAFF FOR THIS DATE
                lockStaff(staff.id, dateStr);
            }
        });
        dLoop.setDate(dLoop.getDate() + 1);
    }

    // B. Apply Existing DB Assignments (Initial State) & Lock them if necessary?
    // Actually, getting schedule usually assumes generating FROM SCRATCH or filling gaps.
    // If we want to respectful of existing manual edits:
    existingAssignments.forEach(a => {
        if (!a.start_time || !a.end_time) return;
        if (!memoryAssignments[a.staffId]) memoryAssignments[a.staffId] = {};
        if (!memoryAssignments[a.staffId][a.data]) memoryAssignments[a.staffId][a.data] = [];
        // Only add if not already added by Fixed Logic (avoid dups if DB has them)
        // Checks logic omitted for brevity, assuming Generation clears range or we merge.
        // If we are appending, we need to check dupes.
        // For now, trust memoryAssignments.

        // Populate memory if not present (Fixed logic populated newAssignments, but we need memory for checks)
        // Double check existence?
        const exists = memoryAssignments[a.staffId][a.data].some(x => x.rawStart === a.start_time && x.rawEnd === a.end_time);
        if (!exists) {
            memoryAssignments[a.staffId][a.data].push({
                s: toMinutes(a.start_time),
                e: toMinutes(a.end_time),
                rawStart: a.start_time,
                rawEnd: a.end_time
            });
        }
    });

    // Track Weekly Hours
    const staffHours: Record<number, number> = {};
    staffList.forEach(s => staffHours[s.id] = 0);

    // Calc hours from Memory (includes Fixed Shifts we just planned + existing)
    Object.keys(memoryAssignments).forEach(sidStr => {
        const sid = Number(sidStr);
        const dates = memoryAssignments[sid];
        Object.keys(dates).forEach(date => {
            if (date >= startDate && date <= endDate) {
                dates[date].forEach(slot => {
                    staffHours[sid] = (staffHours[sid] || 0) + (slot.e - slot.s) / 60;
                });
            }
        });
    });


    // 2. Process Requirements
    // ----------------------
    // Flatten CoverageRows into discrete Shift Tasks
    type ShiftTask = {
        date: string;
        start: string;
        end: string;
        station: string;
        type: 'LUNCH' | 'DINNER';
    };

    const tasks: ShiftTask[] = [];

    let curr = new Date(startD);
    while (curr <= endD) {
        const dateStr = curr.toISOString().split('T')[0];

        // Find rows for this week
        // (Simplified matching: check weekStart. In production, exact week logic required)
        const activeRows = coverageRows.filter(r => {
            // Check if dateStr roughly falls in r.weekStart week.
            // For safety, we trust the Query logic or check explicitly.
            // Let's assume passed rows are relevant.
            // Check if JSON has slot for this date.
            const slots = JSON.parse(r.slots);
            return !!slots[dateStr];
        });

        for (const row of activeRows) {
            const slots = JSON.parse(row.slots);
            const day = slots[dateStr];
            if (!day) continue;

            // Active check
            let isActive = true;
            try { if (JSON.parse(row.extra).active === false) isActive = false; } catch { }
            if (!isActive) continue;

            if (day.lIn && day.lOut) tasks.push({ date: dateStr, start: day.lIn, end: day.lOut, station: row.station, type: 'LUNCH' });
            if (day.dIn && day.dOut) tasks.push({ date: dateStr, start: day.dIn, end: day.dOut, station: row.station, type: 'DINNER' });
        }

        curr.setDate(curr.getDate() + 1);
    }

    // Sort tasks Chronologically
    tasks.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return toMinutes(a.start) - toMinutes(b.start);
    });

    // CRITICAL FIX: Deduplicate tasks to prevent duplicate station assignments
    // If multiple coverageRows exist for same station, we get duplicate tasks
    const uniqueTasks: ShiftTask[] = [];
    const taskKeys = new Set<string>();

    for (const task of tasks) {
        const key = `${task.date}|${task.start}|${task.end}|${task.station}|${task.type}`;
        if (!taskKeys.has(key)) {
            taskKeys.add(key);
            uniqueTasks.push(task);
        } else {
            console.log(`[Scheduler] ⚠️ Skipped duplicate task: ${task.station} on ${task.date} ${task.start}-${task.end}`);
        }
    }

    console.log(`[Scheduler] Tasks: ${tasks.length} total, ${uniqueTasks.length} unique (removed ${tasks.length - uniqueTasks.length} duplicates)`);

    // Group by (Date + ShiftType) to handle "Batch" constraints (like distribution of Seniors)
    // Actually, we process task by task for simplicity, but "Senior per Role" means per *Role* per Shift.
    // We can just try to fill tasks.

    // const newAssignments: any[] = [];

    for (const task of uniqueTasks) {
        // 3. Score Candidates
        // ------------------

        // Filter potential staff
        let candidates = staffList.filter(s => {
            // b. Locked Check (Fixed Shift Exclusivity)
            if (isLocked(s.id, task.date)) return false;

            // c. Station Match (Strict)
            // Ensure staff has this station in their list
            const hasStation = s.postazioni.some(p => p.toLowerCase().trim() === task.station.toLowerCase().trim());
            if (!hasStation) return false;

            // d. Availability & Permissions (Strict)
            const sM = toMinutes(task.start);
            const eM = toMinutes(task.end);

            // i. Check Unavailabilities
            const isUnav = s.unavailabilities.some((u: any) => {
                if (u.data !== task.date) return false;
                const typeMatches = ['TOTALE', 'FERIE', 'MALATTIA', 'PERMESSO'].includes(u.tipo); // Added PERMESSO just in case
                if (typeMatches) {
                    console.log(`[Scheduler] Blocked ${s.nome} on ${task.date}: Type ${u.tipo}`);
                    return true;
                }
                if (u.start_time && u.end_time) {
                    const uS = toMinutes(u.start_time);
                    const uE = toMinutes(u.end_time);
                    const overlaps = (sM < uE && eM > uS);
                    if (overlaps) console.log(`[Scheduler] Blocked ${s.nome} on ${task.date}: Overlap ${u.start_time}-${u.end_time} with Task ${task.start}-${task.end}`);
                    return overlaps;
                }
                return false;
            });
            if (isUnav) return false;

            // ii. Check Permission Requests
            const hasPermission = approvedPermissions.some(p => {
                if (p.staffId !== s.id) return false;
                if (p.data !== task.date) return false;
                // If it's a "Partial" permission (has times), treat as unavailability overlaps
                // If it's "FERIE"/"PERMESSO" without times, treat as Full Day
                if (p.startTime && p.endTime) {
                    const pS = toMinutes(p.startTime);
                    const pE = toMinutes(p.endTime);
                    // If shift overlaps permission time
                    return (sM < pE && eM > pS);
                }
                // Full day block
                return true;
            });
            if (hasPermission) return false;


            // e. Occupancy (Already working?)
            const worked = memoryAssignments[s.id]?.[task.date] || [];
            const isOccupied = worked.some(w => (sM < w.e && eM > w.s));
            if (isOccupied) return false;

            // f. 11h Rest Rule
            // Check PREVIOUS day's last shift end vs THIS shift start
            const prevDate = new Date(task.date);
            prevDate.setDate(prevDate.getDate() - 1);
            const prevDateStr = prevDate.toISOString().split('T')[0];

            const prevShifts = memoryAssignments[s.id]?.[prevDateStr] || [];
            if (prevShifts.length > 0) {
                const lateShift = _.maxBy(prevShifts, 'e');
                if (lateShift) {
                    const prevEndAbs = lateShift.e; // Mins from 00:00 prev day
                    const currStartAbs = sM + 1440; // Mins from 00:00 prev day
                    if (currStartAbs - prevEndAbs < 660) return false; // 660 min = 11h
                }
            }

            // g. Max Hours Check (Strict)
            // Calculate duration properly handling overnight shifts
            let shiftDurationMins = eM - sM;
            if (shiftDurationMins < 0) shiftDurationMins += 1440; // Handle 18:00 - 01:00 cases

            const shiftDurationHours = shiftDurationMins / 60;
            const currentHours = staffHours[s.id] || 0;

            // Allow small buffer (e.g., 15 mins) or strict? User asked for strict "non assegnare più ore".
            // Strict:
            if (currentHours + shiftDurationHours > s.oreMassime) return false;

            return true;
        });

        // f. Blacklist Check
        // We look at who is ALREADY assigned to this [Date, ShiftType] (roughly overlapping).
        // Find all staff currently working in this time slot
        const concurrentStaffIds = new Set<number>();
        for (const [sid, daysMap] of Object.entries(memoryAssignments)) {
            const shifts = daysMap[task.date] || [];
            const overlaps = shifts.some(w => {
                // Fix overlap check for overnight?
                // Simple overlap: StartA < EndB && EndA > StartB
                // If shifts wrap, it's complex. Assuming standard day shifts or consistent encoding.
                // For safety: if w spans midnight, it might be stored as two chunks or handled by date.
                // Given current simple logic, assume standard day overlap check is enough for now, 
                // but `toMinutes` issue applies here too if w.e < w.s
                // Let's rely on tasks being sorted and simple.
                return (toMinutes(task.start) < w.e && toMinutes(task.end) > w.s);
            });
            if (overlaps) concurrentStaffIds.add(Number(sid));
        }

        candidates = candidates.filter(s => {
            // Check if s is blacklisted with anyone in concurrentStaffIds
            for (const partnerId of concurrentStaffIds) {
                const isBad = blacklistPairs.some(p => (p[0] === s.id && p[1] === partnerId) || (p[1] === s.id && p[0] === partnerId));
                if (isBad) return false;
            }
            // Incompatibility ID Check
            if (s.incompatibilityId) {
                const clash = staffList.find(c => concurrentStaffIds.has(c.id) && c.incompatibilityId === s.incompatibilityId);
                if (clash) return false;
            }
            return true;
        });

        // 4. Scoring / Selection
        // ---------------------
        // We need to select 1 person for this task.

        // Shuffle first for randomness
        candidates = _.shuffle(candidates);

        // Heuristic: Prefer SENIOR if we need coverage?
        // "Algorithm guarantees at least one Senior per role".
        // We check if a Senior is ALREADY assigned to this slot/role.
        // If NOT, we prioritize Seniors.

        const roleAssignedStaffIds = Array.from(concurrentStaffIds).filter(sid => {
            // Check if they are working the SAME STATION/ROLE
            // Not easy to know exact role of concurrent assignment without storing it.
            // We can check memoryAssignments but we didn't store Station there.
            // Let's approximate: If someone is working, assume they cover their role.
            // Better: We track assignments with metadata.
            return true;
        });

        // To strictly enforce "One Senior per Role", we need to know if the slot *needs* a Senior.
        // Simplification: Prioritize Senior if this is the FIRST slot of this Role in this Shift?
        // Or just Boost score of Seniors.

        candidates.sort((a, b) => {
            let scoreA = 0;
            let scoreB = 0;

            // Factor 1: Weekly Hours (balance)
            // Lower is better.
            scoreA -= (staffHours[a.id] || 0);
            scoreB -= (staffHours[b.id] || 0);

            // Factor 2: Seniority (Boost)
            if (a.skillLevel === 'SENIOR') scoreA += 50;
            if (b.skillLevel === 'SENIOR') scoreB += 50;

            return scoreB - scoreA; // Descending
        });

        // Pick top
        const best = candidates[0];

        if (best) {
            // Assign
            newAssignments.push({
                staffId: best.id,
                data: task.date,
                start_time: task.start,
                end_time: task.end,
                postazione: task.station,
                status: false,
                tenantKey
            });

            // Update Memory
            let durMins = toMinutes(task.end) - toMinutes(task.start);
            if (durMins < 0) durMins += 1440;

            if (!memoryAssignments[best.id]) memoryAssignments[best.id] = {};
            if (!memoryAssignments[best.id][task.date]) memoryAssignments[best.id][task.date] = [];
            memoryAssignments[best.id][task.date].push({
                s: toMinutes(task.start),
                e: toMinutes(task.end),
                rawStart: task.start,
                rawEnd: task.end
            });

            // Update Hours
            staffHours[best.id] = (staffHours[best.id] || 0) + (durMins / 60);
        } else {
            // No candidate found!
            console.log(`[Scheduler] ⚠️ UNASSIGNED: ${task.date} ${task.start}-${task.end} ${task.station}`);
            unassigned.push({
                date: task.date,
                start: task.start,
                end: task.end,
                station: task.station,
                type: task.type,
                reason: 'Nessun candidato disponibile (ore, competenze o disponibilità)'
            });
        }
    }

    console.log(`[Scheduler] Complete. Assigned: ${newAssignments.length}, Unassigned: ${unassigned.length}`);
    return { assignments: newAssignments, unassigned };
}
