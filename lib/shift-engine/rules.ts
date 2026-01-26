
import { ShiftRule, EngineContext, ValidationResult } from './types';
import { differenceInMinutes, parseISO, addDays, isSameDay, startOfDay, getISOWeek, endOfWeek, startOfWeek } from 'date-fns';
import _ from 'lodash';
import { generateTasksFromCoverage, toMinutes } from '../scheduler-utils';

// --- Helpers ---

function getDateTime(dateStr: string, timeStr: string): Date {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(dateStr);
    d.setHours(h, m, 0, 0);
    return d;
}



function getShiftDurationHours(start: string, end: string): number {
    let s = toMinutes(start);
    let e = toMinutes(end);
    let dur = e - s;
    if (dur < 0) dur += 1440; // Overnight
    return dur / 60;
}

// --- Rules ---

export const MinRestRule: ShiftRule = {
    id: 'MIN_REST_11H',
    name: 'Riposo Minimo 11 Ore',
    active: true,
    validate(context: EngineContext): ValidationResult[] {
        const errors: ValidationResult[] = [];
        const { assignments, previousWindowAssignments, config } = context;

        // Group by staff
        const allAssignments = [...(previousWindowAssignments || []), ...assignments];
        const staffAssignments = _.groupBy(allAssignments, 'staffId');

        for (const staffIdStr in staffAssignments) {
            const staffId = Number(staffIdStr);
            // Sort by Date + StartTime
            const shifts = staffAssignments[staffId].sort((a, b) => {
                if (a.data !== b.data) return a.data.localeCompare(b.data);
                return (a.start_time || '').localeCompare(b.start_time || '');
            });

            for (let i = 1; i < shifts.length; i++) {
                const prev = shifts[i - 1];
                const curr = shifts[i];

                if (!prev.end_time || !curr.start_time) continue;

                // Skip if current shift is not in the "Active Window" (i.e. it's from previous assignments just for check)
                // We only report errors for assignments in the current context list
                const isCurrentShiftInWindow = assignments.some(a => a.id === curr.id);
                if (!isCurrentShiftInWindow) continue;

                const prevEnd = getDateTime(prev.data, prev.end_time);
                // Handle overnight prev shift: if end < start, it ends next day?
                // Actually Assignment logic usually stores date as "Start Date".
                // If prev shift is 18:00 - 02:00, it ends on Date+1 02:00.
                if (toMinutes(prev.end_time) < toMinutes(prev.start_time!)) {
                    prevEnd.setDate(prevEnd.getDate() + 1);
                }

                const currStart = getDateTime(curr.data, curr.start_time);

                const diffMinutes = differenceInMinutes(currStart, prevEnd);
                const minRestMinutes = config.minRestHours * 60;

                if (diffMinutes < minRestMinutes) {
                    errors.push({
                        ruleId: 'MIN_REST_11H',
                        staffId,
                        level: 'ERROR',
                        message: `Riposo insufficiente: ${Math.floor(diffMinutes / 60)}h ${diffMinutes % 60}m invece di ${config.minRestHours}h tra il turno del ${prev.data} e quello del ${curr.data}`,
                        date: curr.data,
                        metadata: { prevId: prev.id, currId: curr.id, diffMinutes }
                    });
                }
            }
        }
        return errors;
    }
};

export const MaxWeeklyHoursRule: ShiftRule = {
    id: 'MAX_WEEKLY_HOURS',
    name: 'Limite Ore Settimanali',
    active: true,
    validate(context: EngineContext): ValidationResult[] {
        const errors: ValidationResult[] = [];
        const { assignments, staffList, config } = context;

        // This rule validates strict weekly hours (ISO Weeks) AND/OR Rolling Window
        // Use ISO Week for contractual/legal standard often used in Italy.
        // OR Use Rolling 7 days? Req says "7 giorni mobili" -> Rolling.

        const staffMap = _.groupBy(assignments, 'staffId');

        for (const staffIdStr in staffMap) {
            const staffId = Number(staffIdStr);
            const staff = staffList.find(s => s.id === staffId);
            if (!staff) continue;

            const shifts = staffMap[staffIdStr].sort((a, b) => a.data.localeCompare(b.data));
            if (shifts.length === 0) continue;

            // Rolling 7-day Window Check
            // Verify every sequence of days d to d+6
            // Efficient approach: iterate all unique days in sorted order
            const days = _.uniq(shifts.map(s => s.data)).sort();

            for (const startDayStr of days) {
                const startDay = new Date(startDayStr);
                const endDay = addDays(startDay, 6);
                const endDayStr = endDay.toISOString().split('T')[0];

                // Sum hours in this window [startDay, endDay]
                const windowShifts = shifts.filter(s => s.data >= startDayStr && s.data <= endDayStr);
                const totalHours = windowShifts.reduce((sum, s) => sum + getShiftDurationHours(s.start_time!, s.end_time!), 0);

                // Check Limit
                // Use staff-specific limit if lower? Or strict 40h?
                // Req: "Limite di 40 ore". Staff might have 'oreMassime' < 40 or > 40.
                // Usually legal limit is 48h avg.
                // Let's use Config Max (40) or Staff Max if defined?
                // Let's use Math.max(staff.oreMassime, 40) + Tolerance?
                // User said "Limite di 40 ore di lavoro su 7 giorni mobili".
                // We will respect staff.oreMassime but enforce the 40h cap if strict.
                // Or maybe the user *means* existing oreMassime logic but rolling.
                // Let's stick to: Limit = staff.oreMassime + TOLERANCE.

                const limit = (staff.oreMassime || config.maxWeeklyHours) + config.contractToleranceHours;

                if (totalHours > limit) {
                    // Only report once per window or per staff?
                    // Report on the last day of the window
                    errors.push({
                        ruleId: 'MAX_WEEKLY_HOURS',
                        staffId,
                        level: 'ERROR',
                        message: `Superato limite ore (${limit.toFixed(1)}h): assegnate ${totalHours.toFixed(1)}h nel periodo ${startDayStr} - ${endDayStr}`,
                        date: endDayStr,
                        metadata: { totalHours, limit, startDayStr, endDayStr }
                    });
                    // Optimization: Skip to next window start?
                    // Don't spam errors for overlapping windows if possible
                    // But overlapping windows are distinct violations.
                }
            }
        }

        return errors;
    }
};

export const ConsecutiveDaysRule: ShiftRule = {
    id: 'MAX_CONSECUTIVE_DAYS',
    name: 'Massimo 6 Giorni Consecutivi',
    active: true,
    validate(context: EngineContext): ValidationResult[] {
        const errors: ValidationResult[] = [];
        const { assignments, previousWindowAssignments, config } = context;

        const allAssignments = [...(previousWindowAssignments || []), ...assignments];
        const staffMap = _.groupBy(allAssignments, 'staffId');

        for (const staffIdStr in staffMap) {
            const staffId = Number(staffIdStr);
            const shifts = staffMap[staffIdStr].sort((a, b) => a.data.localeCompare(b.data));
            const distinctDays = _.uniq(shifts.map(s => s.data)).sort();

            let consec = 0;
            let lastDate: Date | null = null;
            let sequenceStartDate: string = distinctDays[0];

            for (const dateStr of distinctDays) {
                const currDate = new Date(dateStr);

                if (lastDate) {
                    const diff = differenceInMinutes(currDate, lastDate);
                    // 24h * 60 = 1440. Allow some slack for daylight saving? diff of 1 day is approx 1440.
                    // If diff is <= 24h + buffer, it's consecutive.
                    // Actually checking differenceInDays(curr, last) === 1 is safer.
                    // Since we have YYYY-MM-DD strings, we can just check if prev + 1 day == curr.

                    const expectedPrev = addDays(currDate, -1).toISOString().split('T')[0];
                    const actualPrev = lastDate.toISOString().split('T')[0];

                    if (expectedPrev === actualPrev) {
                        consec++;
                    } else {
                        consec = 1;
                        sequenceStartDate = dateStr;
                    }
                } else {
                    consec = 1;
                    sequenceStartDate = dateStr;
                }

                lastDate = currDate;

                // Check if strict violation ( > 6 days)
                if (consec > config.maxConsecutiveDays) {
                    // Only report if the violation *ends* in the current window (not historical)
                    const isViolationInWindow = assignments.some(a => a.staffId === staffId && a.data === dateStr);

                    if (isViolationInWindow) {
                        errors.push({
                            ruleId: 'MAX_CONSECUTIVE_DAYS',
                            staffId,
                            level: 'ERROR',
                            message: `Troppi giorni consecutivi: ${consec} giorni dal ${sequenceStartDate} al ${dateStr}`,
                            date: dateStr,
                            metadata: { consec, sequenceStartDate }
                        });
                    }
                }
            }
        }
        return errors;
    }
}

export const MinimumShiftDurationRule: ShiftRule = {
    id: 'MIN_SHIFT_DURATION',
    name: 'Durata Minima Turno',
    active: true,
    validate(context: EngineContext): ValidationResult[] {
        const errors: ValidationResult[] = [];
        const { assignments } = context;

        const staffMap = _.groupBy(assignments, 'staffId');

        for (const staffIdStr in staffMap) {
            const staffId = Number(staffIdStr);
            const shifts = staffMap[staffIdStr].sort((a, b) => a.data.localeCompare(b.data) || (a.start_time || '').localeCompare(b.start_time || ''));

            for (const shift of shifts) {
                if (!shift.start_time || !shift.end_time) continue;

                const duration = getShiftDurationHours(shift.start_time, shift.end_time);

                if (duration < 6) {
                    const templateName = (shift as any).shiftTemplate?.nome?.toLowerCase() || '';
                    const stationName = shift.postazione?.toLowerCase() || '';
                    const isScarico = templateName.includes('scarico') || stationName.includes('scarico');

                    if (isScarico) {
                        const hasAdjacentPranzo = shifts.some(other => {
                            if (other.id === shift.id) return false;
                            if (other.data !== shift.data) return false;

                            const otherName = (other as any).shiftTemplate?.nome?.toLowerCase() || '';
                            const otherStation = other.postazione?.toLowerCase() || '';
                            const isPranzo = otherName.includes('pranzo') || otherStation.includes('pranzo') || otherName.includes('lunch');

                            if (!isPranzo) return false;

                            const s1 = toMinutes(shift.start_time!);
                            let e1 = toMinutes(shift.end_time!);
                            if (e1 < s1) e1 += 1440;

                            const s2 = toMinutes(other.start_time!);
                            let e2 = toMinutes(other.end_time!);
                            if (e2 < s2) e2 += 1440;

                            const touch = (Math.abs(e1 - s2) <= 15 || Math.abs(e2 - s1) <= 15);
                            const overlap = (s1 < e2 && e1 > s2);

                            return touch || overlap;
                        });

                        if (hasAdjacentPranzo) continue;
                    }

                    errors.push({
                        ruleId: 'MIN_SHIFT_DURATION',
                        staffId,
                        level: 'WARNING',
                        message: `Turno troppo breve (${duration.toFixed(1)}h). Minimo 6h richiesto.`,
                        date: shift.data,
                        metadata: { duration, isScarico }
                    });
                }
            }
        }
        return errors;
    }
};

export const OrphanedHoursRule: ShiftRule = {
    id: 'ORPHANED_HOURS',
    name: 'Ore Orfane (Fixed Split)',
    active: true,
    validate(context: EngineContext): ValidationResult[] {
        const errors: ValidationResult[] = [];
        const { assignments, coverageRows } = context;

        if (!coverageRows || coverageRows.length === 0) return [];

        const dates = [...new Set(assignments.map(a => a.data))].sort();
        if (dates.length === 0) return [];
        const start = dates[0];
        const end = dates[dates.length - 1];

        const requiredTasks = generateTasksFromCoverage(coverageRows, start, end);

        const assignmentsByDayStation = _.groupBy(assignments, a => `${a.data}|${a.postazione}`);
        const tasksByDayStation = _.groupBy(requiredTasks, t => `${t.date}|${t.station}`);

        for (const key in tasksByDayStation) {
            const reqTasks = tasksByDayStation[key];
            const assigned = assignmentsByDayStation[key] || [];

            for (const req of reqTasks) {
                const reqStart = toMinutes(req.start);
                const reqEnd = toMinutes(req.end);

                const covering = assigned.filter(a => {
                    const s = toMinutes(a.start_time!);
                    let e = toMinutes(a.end_time!);
                    if (e < s) e += 1440;
                    return (s < reqEnd && e > reqStart);
                });

                if (covering.length === 0) continue;

                const starts = covering.map(a => toMinutes(a.start_time!));
                const minStart = Math.min(...starts);

                if (minStart > reqStart + 15) {
                    const gapEnd = covering.find(a => toMinutes(a.start_time!) === minStart)?.start_time || '??';

                    const diffMins = minStart - reqStart;
                    const diffHours = diffMins / 60;

                    if (diffMins >= 30) {
                        const [date, station] = key.split('|');
                        errors.push({
                            ruleId: 'ORPHANED_HOURS',
                            staffId: 0,
                            level: 'INFO',
                            message: `Ora orfana rilevata (${req.start}-${gapEnd}). Assegnare a un altro collaboratore.`,
                            date: req.date,
                            metadata: { station: req.station, gapStart: req.start, gapEnd, diffHours }
                        });
                    }
                }
            }
        }

        return errors;
    }
};
