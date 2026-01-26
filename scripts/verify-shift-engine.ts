
import { ShiftEngine } from '../lib/shift-engine/engine';
import { EngineContext, ValidationResult } from '../lib/shift-engine/types';

// Mock Data
const mockStaff = [
    { id: 1, nome: 'Mario', oreMassime: 40 },
    { id: 2, nome: 'Luigi', oreMassime: 20 },
];

// Scenario 1: Rest Violation (Mario work till 23:00, start 08:00 next day = 9h rest < 11h)
const assignmentsRest = [
    { id: 1, staffId: 1, data: '2026-01-01', start_time: '15:00', end_time: '23:00' },
    { id: 2, staffId: 1, data: '2026-01-02', start_time: '08:00', end_time: '16:00' }
];

// Scenario 2: Max Hours (Mario works 5 days x 10h = 50h > 40h)
const assignmentsHours = [
    { id: 3, staffId: 1, data: '2026-01-03', start_time: '08:00', end_time: '18:00' },
    { id: 4, staffId: 1, data: '2026-01-04', start_time: '08:00', end_time: '18:00' },
    { id: 5, staffId: 1, data: '2026-01-05', start_time: '08:00', end_time: '18:00' },
    { id: 6, staffId: 1, data: '2026-01-06', start_time: '08:00', end_time: '18:00' },
    { id: 7, staffId: 1, data: '2026-01-07', start_time: '08:00', end_time: '18:00' },
];

// Scenario 3: Consecutive Days (Luigi works 7 days)
const assignmentsConsec = [];
for (let i = 1; i <= 7; i++) {
    assignmentsConsec.push({
        id: 10 + i,
        staffId: 2,
        data: `2026-01-0${i}`,
        start_time: '09:00',
        end_time: '12:00'
    });
}

// Scenario 4: Min Duration (Short Shift)
const assignmentsShort = [
    { id: 20, staffId: 1, data: '2026-01-08', start_time: '09:00', end_time: '12:00', shiftTemplate: { nome: 'Normal' } }
];
// Scenario 5: Min Duration Exception (Scarico + Pranzo)
const assignmentsScarico = [
    { id: 21, staffId: 1, data: '2026-01-09', start_time: '11:00', end_time: '12:00', shiftTemplate: { nome: 'Scarico' }, postazione: 'Scarico' },
    { id: 22, staffId: 1, data: '2026-01-09', start_time: '12:00', end_time: '15:00', shiftTemplate: { nome: 'Pranzo' }, postazione: 'Cucina' }
];

// Scenario 6: Orphaned Hours
// Requirement: 12:00-15:00 (from manually coverage mock below)
// Assignment: 13:00-15:00 (Gap 12-13)
const assignmentsOrphan = [
    { id: 30, staffId: 3, data: '2026-01-10', start_time: '13:00', end_time: '15:00', postazione: 'Cucina', shiftTemplate: { nome: 'Fixed' } }
];

const mockCoverage = [
    {
        weekStart: '2026-01-01', // Assumed week
        station: 'Cucina',
        slots: JSON.stringify({
            '2026-01-10': { lIn: '12:00', lOut: '15:00' }
        }),
        extra: JSON.stringify({ active: true })
    }
];

const context: EngineContext = {
    staffList: mockStaff as any,
    assignments: [...assignmentsRest, ...assignmentsHours, ...assignmentsConsec, ...assignmentsShort, ...assignmentsScarico, ...assignmentsOrphan] as any,
    previousWindowAssignments: [],
    unavailabilities: [],
    coverageRows: mockCoverage as any,
    config: {
        maxWeeklyHours: 40,
        minRestHours: 11,
        maxConsecutiveDays: 6,
        contractToleranceHours: 1
    }
};

const engine = new ShiftEngine();
const results = engine.validate(context);

console.log('--- Validation Results ---');
results.forEach(r => {
    console.log(`[${r.level}] ${r.ruleId} (Staff ${r.staffId}): ${r.message}`);
});

if (results.length === 0) console.log('No errors found (Unexpected!)');
