
import { Staff, Assignment, Unavailability } from '@prisma/client';

export type ShiftValidationLevel = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface ValidationResult {
    ruleId: string;
    staffId: number;
    level: ShiftValidationLevel;
    message: string;
    date: string; // The specific date of violation, or start of the period
    metadata?: any;
}

export interface EngineContext {
    staffList: Staff[];
    assignments: Assignment[]; // All assignments in the window being checked
    unavailabilities: Unavailability[];
    coverageRows?: any[]; // Prisma CoverageRow[]
    previousWindowAssignments?: Assignment[]; // For looking back (e.g. 11h rest)
    config: {
        maxWeeklyHours: number; // 40
        minRestHours: number; // 11
        maxConsecutiveDays: number; // 6
        contractToleranceHours: number; // 1
    };
    forecastData?: any[]; // For coverage check
}

export interface ShiftRule {
    id: string;
    name: string;
    active: boolean;
    validate(context: EngineContext): ValidationResult[];
}
