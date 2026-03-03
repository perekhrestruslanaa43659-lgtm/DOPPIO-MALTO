
/**
 * PIT Engine — Punteggio Intensità Turno
 * ----------------------------------------
 * Pure TypeScript logic (no Prisma). Computes shift intensity scores,
 * classifies staff seniority, and analyses a full week for violations
 * and workload imbalances.
 *
 * Formula:
 *   PIT = H_weight × D_weight × V_weight
 *     H_weight = 2.0 (Dinner/Sera)  | 1.0 (Lunch/Pranzo)
 *     D_weight = 1.8 (Fri/Sat/Sun)  | 1.0 (Mon–Thu)
 *     V_weight = 1.5 (covers > 70% capacity) | 1.0 otherwise
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ShiftType = 'PRANZO' | 'SERA';

export interface PITSlot {
    date: string;           // YYYY-MM-DD
    shiftType: ShiftType;
    pit: number;            // Computed PIT score (≥ 1.0)
    covers: number;         // budgetCoversDinner / budgetCoversLunch
    capacity: number;       // Venue max covers used for calculation
    seniorCount: number;    // Senior staff assigned to this slot
    totalCount: number;     // Total staff assigned to this slot
    seniorRatio: number;    // seniorCount / totalCount  (0–1)
    violations: string[];   // e.g. "< 40% Senior su turno ad alta intensità"
}

export interface StaffPITLoad {
    staffId: number;
    nome: string;
    cognome: string;
    ruolo: string;
    skillLevel: string;
    isSenior: boolean;
    hoursUsed: number;      // Hours scheduled in the analysed week
    hoursMax: number;       // oreMassime from DB
    diff: number;           // hoursMax - hoursUsed  (positive = headroom)
    weekendShiftsCount: number;
    pitContribution: number; // Sum of PIT scores for all shifts worked
}

export interface WeekAnalysis {
    slots: PITSlot[];
    staffAnalysis: StaffPITLoad[];
    highIntensitySlots: PITSlot[];    // PIT > 3.5
    violations: PITSlot[];            // Slots with violations
    seniorUtilization: number;        // Avg senior ratio across high-intensity slots
}

// ─────────────────────────────────────────────────────────────────────────────
// PIT Calculation
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_CAPACITY = 200; // Venue default max covers

/**
 * Returns H-weight for a shift type.
 * Dinner (SERA) = 2.0, Lunch (PRANZO) = 1.0
 */
export function getHWeight(shiftType: ShiftType): number {
    return shiftType === 'SERA' ? 2.0 : 1.0;
}

/**
 * Returns D-weight for a given ISO day of week.
 * dayOfWeek: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
 * Weekend (Fri=5, Sat=6, Sun=0) = 1.8; Weekdays = 1.0
 */
export function getDWeight(dayOfWeek: number): number {
    return (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) ? 1.8 : 1.0;
}

/**
 * Returns V-weight based on cover volume vs capacity.
 * covers > 70% of capacity → 1.5x multiplier
 */
export function getVWeight(covers: number, capacity: number = DEFAULT_CAPACITY): number {
    if (capacity <= 0) return 1.0;
    return covers / capacity > 0.70 ? 1.5 : 1.0;
}

/**
 * Computes the full PIT score for a shift slot.
 */
export function calculatePIT(params: {
    shiftType: ShiftType;
    dayOfWeek: number;
    covers: number;
    capacity?: number;
}): number {
    const { shiftType, dayOfWeek, covers, capacity = DEFAULT_CAPACITY } = params;
    const h = getHWeight(shiftType);
    const d = getDWeight(dayOfWeek);
    const v = getVWeight(covers, capacity);
    // Round to 2 decimals for display
    return Math.round(h * d * v * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// Seniority Classification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if a staff member should be considered Senior.
 * Uses both the `ruolo` field and the `skillLevel` DB field.
 * Senior = skillLevel === 'SENIOR' or role implies management/leadership.
 */
export function isSenior(ruolo: string, skillLevel: string): boolean {
    if (skillLevel === 'SENIOR') return true;

    const r = (ruolo ?? '').toLowerCase();
    return (
        r.includes('manager') ||
        r.includes('direttore') ||
        r.includes('vice') ||
        r.includes('store') ||
        r.includes('general') ||
        r.includes('titolare') ||
        r.includes('responsabile') ||
        r.includes('junior manager') ||
        r.includes('capo') ||
        r.includes('chef') ||
        r === 'rm' ||
        r === 'vrm' ||
        r === 'vd' ||
        r === 'jm' ||
        r === 'dir'
    );
}

/**
 * Returns a human-readable seniority label.
 */
export function getSeniorityLabel(ruolo: string, skillLevel: string): 'Senior' | 'Junior' {
    return isSenior(ruolo, skillLevel) ? 'Senior' : 'Junior';
}

// ─────────────────────────────────────────────────────────────────────────────
// Week Analysis
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalysisStaff {
    id: number;
    nome: string;
    cognome: string;
    ruolo: string;
    skillLevel: string;
    oreMassime: number;
}

export interface AnalysisAssignment {
    staffId: number;
    data: string;          // YYYY-MM-DD
    start_time: string | null;
    end_time: string | null;
}

export interface AnalysisBudget {
    data: string;
    budgetCoversLunch: number;
    budgetCoversDinner: number;
}

function calcHours(start: string | null, end: string | null): number {
    if (!start || !end) return 0;
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    let diff = (h2 + m2 / 60) - (h1 + m1 / 60);
    if (diff < 0) diff += 24;
    return diff;
}

function isLunchShift(start_time: string | null): boolean {
    if (!start_time) return true;
    const hour = parseInt(start_time.split(':')[0], 10);
    return hour < 17;
}

function isWeekend(dayOfWeek: number): boolean {
    return dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
}

const MIN_SENIOR_RATIO = 0.40;    // 40% minimum senior coverage
const HIGH_PIT_THRESHOLD = 3.5;  // Slots above this require senior monitoring

/**
 * Builds a full analysis of a given week:
 * - Computes PIT for each date × shiftType slot
 * - Computes staff hours, weekend counts, PIT contribution
 * - Detects violations (min senior ratio on high-PIT slots)
 */
export function analyzeWeek(
    dates: string[],            // ['2026-02-24', ...] for the week
    staff: AnalysisStaff[],
    assignments: AnalysisAssignment[],
    budgets: AnalysisBudget[],
    capacity: number = DEFAULT_CAPACITY
): WeekAnalysis {
    const slots: PITSlot[] = [];

    // Per-staff tracking
    const staffHours: Record<number, number> = {};
    const staffWeekendCount: Record<number, number> = {};
    const staffPITContrib: Record<number, number> = {};
    staff.forEach(s => {
        staffHours[s.id] = 0;
        staffWeekendCount[s.id] = 0;
        staffPITContrib[s.id] = 0;
    });

    // Accumulate hours and weekend shifts from assignments
    assignments.forEach(a => {
        staffHours[a.staffId] = (staffHours[a.staffId] ?? 0) + calcHours(a.start_time, a.end_time);
        const dayOfWeek = new Date(a.data).getDay();
        if (isWeekend(dayOfWeek)) {
            staffWeekendCount[a.staffId] = (staffWeekendCount[a.staffId] ?? 0) + 1;
        }
    });

    // Build a budget lookup
    const budgetByDate: Record<string, AnalysisBudget> = {};
    budgets.forEach(b => { budgetByDate[b.data] = b; });

    // Process each date × shift type
    for (const date of dates) {
        const dayOfWeek = new Date(date).getDay();
        const budget = budgetByDate[date];

        for (const shiftType of ['PRANZO', 'SERA'] as ShiftType[]) {
            const covers = budget
                ? (shiftType === 'PRANZO' ? budget.budgetCoversLunch : budget.budgetCoversDinner)
                : 0;

            const pit = calculatePIT({ shiftType, dayOfWeek, covers, capacity });

            // Find assignments for this date × type
            const slotAssignments = assignments.filter(a => {
                if (a.data !== date) return false;
                return shiftType === 'PRANZO' ? isLunchShift(a.start_time) : !isLunchShift(a.start_time);
            });

            const totalCount = slotAssignments.length;
            const seniorStaffIds = new Set(
                staff.filter(s => isSenior(s.ruolo, s.skillLevel)).map(s => s.id)
            );
            const seniorCount = slotAssignments.filter(a => seniorStaffIds.has(a.staffId)).length;
            const seniorRatio = totalCount > 0 ? seniorCount / totalCount : 0;

            // Track PIT contribution per staff
            slotAssignments.forEach(a => {
                staffPITContrib[a.staffId] = (staffPITContrib[a.staffId] ?? 0) + pit;
            });

            // Detect violations
            const violations: string[] = [];
            if (pit > HIGH_PIT_THRESHOLD && totalCount > 0 && seniorRatio < MIN_SENIOR_RATIO) {
                violations.push(
                    `Solo ${Math.round(seniorRatio * 100)}% Senior (min ${MIN_SENIOR_RATIO * 100}%) su turno ${shiftType} PIT=${pit}`
                );
            }

            slots.push({
                date,
                shiftType,
                pit,
                covers,
                capacity,
                seniorCount,
                totalCount,
                seniorRatio,
                violations
            });
        }
    }

    // Build staff analysis
    const staffAnalysis: StaffPITLoad[] = staff.map(s => ({
        staffId: s.id,
        nome: s.nome,
        cognome: s.cognome,
        ruolo: s.ruolo,
        skillLevel: s.skillLevel,
        isSenior: isSenior(s.ruolo, s.skillLevel),
        hoursUsed: Math.round((staffHours[s.id] ?? 0) * 100) / 100,
        hoursMax: s.oreMassime,
        diff: Math.round((s.oreMassime - (staffHours[s.id] ?? 0)) * 100) / 100,
        weekendShiftsCount: staffWeekendCount[s.id] ?? 0,
        pitContribution: Math.round((staffPITContrib[s.id] ?? 0) * 100) / 100,
    }));

    // Sort staff by PIT contribution desc (most loaded first)
    staffAnalysis.sort((a, b) => b.pitContribution - a.pitContribution);

    const highIntensitySlots = slots.filter(s => s.pit > HIGH_PIT_THRESHOLD);
    const violations = slots.filter(s => s.violations.length > 0);

    // Avg senior ratio across high-intensity slots that have staff assigned
    const coveredHighSlots = highIntensitySlots.filter(s => s.totalCount > 0);
    const seniorUtilization = coveredHighSlots.length > 0
        ? coveredHighSlots.reduce((acc, s) => acc + s.seniorRatio, 0) / coveredHighSlots.length
        : 1; // If no high-intensity slots filled yet, treat as perfect

    return { slots, staffAnalysis, highIntensitySlots, violations, seniorUtilization };
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduler Helpers (used by scheduler.ts)
// ─────────────────────────────────────────────────────────────────────────────

export const PIT_THRESHOLDS = {
    LOW: 2.0,
    MEDIUM: 3.5,
    HIGH: 4.0,
} as const;

export function getPITColor(pit: number): string {
    if (pit >= PIT_THRESHOLDS.MEDIUM) return '#ef4444'; // red
    if (pit >= PIT_THRESHOLDS.LOW) return '#f59e0b';    // amber
    return '#22c55e';                                    // green
}

export function getPITLabel(pit: number): string {
    if (pit >= PIT_THRESHOLDS.HIGH) return 'Critico';
    if (pit >= PIT_THRESHOLDS.MEDIUM) return 'Alto';
    if (pit >= PIT_THRESHOLDS.LOW) return 'Medio';
    return 'Basso';
}

export const MAX_CONSECUTIVE_WEEKENDS = 2;
