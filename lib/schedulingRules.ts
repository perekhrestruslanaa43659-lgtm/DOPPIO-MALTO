// ─────────────────────────────────────────────────────────────────────────────
// lib/schedulingRules.ts
// Defines the built-in rule catalogue and shared types.
// The scheduler reads rules from the DB at runtime; this file provides:
//   1. The canonical list of built-in rules (for seeding + UI display)
//   2. TypeScript types shared across API and scheduler
// ─────────────────────────────────────────────────────────────────────────────

export interface SchedulingRuleRecord {
    id: number;
    tenantKey: string;
    code: string;
    name: string;
    description: string;
    enabled: boolean;
    params: string; // JSON string
    isBuiltin: boolean;
}

/** Parsed params for each rule (typed helpers) */
export interface RuleParams {
    // MAX_HOURS — already using oreMassime on Staff model; this just toggles enforcement
    MAX_HOURS: Record<string, never>;

    // ONE_SHIFT_PER_DAY — no configurable params
    ONE_SHIFT_PER_DAY: Record<string, never>;

    // REST_HOURS — minimum rest in hours between consecutive shifts
    REST_HOURS: { hours: number };

    // MANAGER_SAME_DAY — max managers per day/turno
    MANAGER_SAME_DAY: { max: number; coversThreshold: number };

    // BLACKLIST_RESPECT — respect incompatibilityId pairs
    BLACKLIST_RESPECT: Record<string, never>;

    // FIXED_SHIFTS — respect recurring shift configurations
    FIXED_SHIFTS: Record<string, never>;

    // PERMISSIONS — respect approved FERIE/PERMESSO/MALATTIA
    PERMISSIONS: Record<string, never>;

    // SENIOR_PIT_RATIO — minimum % of PIT-senior staff on high-intensity slots
    SENIOR_PIT_RATIO: { minRatio: number; pitThreshold: number };

    // WEEKEND_EQUITY — try to balance weekend shifts across staff
    WEEKEND_EQUITY: { enabled: boolean };

    // SKILL_FILTER — use StaffCompetency scores to weight/block candidates
    // minScoreToWork: candidates with score < this are blocked (default 2 = allow In-Formazione as fallback)
    // scoreBonus4: bonus points for score=4 Senior
    // scoreBonus5: bonus points for score=5 Senior★
    SKILL_FILTER: { minScoreToWork: number; scoreBonus4: number; scoreBonus5: number };
}

/** Built-in rule definitions (seeded on first API call if DB is empty for tenant) */
export const BUILTIN_RULES: Omit<SchedulingRuleRecord, 'id' | 'tenantKey'>[] = [
    {
        code: 'MAX_HOURS',
        name: 'Ore massime settimanali',
        description: 'Non assegnare più ore di quelle contrattuali settimanali per dipendente.',
        enabled: true,
        params: '{}',
        isBuiltin: true,
    },
    {
        code: 'ONE_SHIFT_PER_DAY',
        name: 'Un turno al giorno',
        description: 'Ogni dipendente può lavorare solo un turno al giorno (no pranzo+cena).',
        enabled: true,
        params: '{}',
        isBuiltin: true,
    },
    {
        code: 'REST_HOURS',
        name: 'Riposo minimo tra turni',
        description: 'Rispetta il riposo minimo legale tra la fine di un turno e l\'inizio del successivo.',
        enabled: true,
        params: JSON.stringify({ hours: 11 } satisfies RuleParams['REST_HOURS']),
        isBuiltin: true,
    },
    {
        code: 'MANAGER_SAME_DAY',
        name: 'Limite manager per giorno',
        description: 'Non assegnare più manager nello stesso giorno, salvo in caso di alto traffico (coperti ≥ soglia).',
        enabled: true,
        params: JSON.stringify({ max: 1, coversThreshold: 180 } satisfies RuleParams['MANAGER_SAME_DAY']),
        isBuiltin: true,
    },
    {
        code: 'BLACKLIST_RESPECT',
        name: 'Rispetta incompatibilità',
        description: 'Non assegnare persone con incompatibilityId uguale nello stesso turno.',
        enabled: true,
        params: '{}',
        isBuiltin: true,
    },
    {
        code: 'FIXED_SHIFTS',
        name: 'Rispetta turni fissi',
        description: 'I turni ricorrenti configurati hanno la precedenza assoluta sull\'auto-scheduler.',
        enabled: true,
        params: '{}',
        isBuiltin: true,
    },
    {
        code: 'PERMISSIONS',
        name: 'Rispetta ferie e permessi',
        description: 'Non assegnare turni in giorni con ferie, malattia o permessi approvati.',
        enabled: true,
        params: '{}',
        isBuiltin: true,
    },
    {
        code: 'SENIOR_PIT_RATIO',
        name: 'Senior minimi in turni intensi',
        description: 'Garantisce una percentuale minima di Senior nei turni ad alta intensità (PIT alto).',
        enabled: true,
        params: JSON.stringify({ minRatio: 0.4, pitThreshold: 3.5 } satisfies RuleParams['SENIOR_PIT_RATIO']),
        isBuiltin: true,
    },
    {
        code: 'WEEKEND_EQUITY',
        name: 'Equità weekend',
        description: 'Distribuisce i turni del weekend in modo equo tra lo staff disponibile.',
        enabled: false,
        params: JSON.stringify({ enabled: false } satisfies RuleParams['WEEKEND_EQUITY']),
        isBuiltin: true,
    },
    {
        code: 'SKILL_FILTER',
        name: 'Filtro competenze (rating postazione)',
        description: 'Usa i rating 1-5 di StaffCompetency per escludere/penalizzare candidati non abilitati e premiare i Senior.',
        enabled: true,
        params: JSON.stringify({ minScoreToWork: 2, scoreBonus4: 60, scoreBonus5: 120 } satisfies RuleParams['SKILL_FILTER']),
        isBuiltin: true,
    },
];

/** Helper: parse params JSON safely */
export function parseParams<T extends object>(json: string, fallback: T): T {
    try {
        return { ...fallback, ...JSON.parse(json) } as T;
    } catch {
        return fallback;
    }
}

/** Helper: build a quick lookup map from a loaded rule array */
export function buildRuleMap(rules: SchedulingRuleRecord[]): Map<string, SchedulingRuleRecord> {
    return new Map(rules.map(r => [r.code, r]));
}

/** Helper: is a rule enabled? */
export function ruleEnabled(map: Map<string, SchedulingRuleRecord>, code: string): boolean {
    const r = map.get(code);
    return r ? r.enabled : true; // default: enabled if not found
}

/** Helper: get parsed params for a rule */
export function getRuleParams<T extends object>(
    map: Map<string, SchedulingRuleRecord>,
    code: string,
    fallback: T
): T {
    const r = map.get(code);
    if (!r) return fallback;
    return parseParams<T>(r.params, fallback);
}
