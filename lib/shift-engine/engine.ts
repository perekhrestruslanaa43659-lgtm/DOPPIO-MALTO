
import { EngineContext, ShiftRule, ValidationResult } from './types';
import { MinRestRule, MaxWeeklyHoursRule, ConsecutiveDaysRule, CoverageRule, MinimumShiftDurationRule, OrphanedHoursRule } from './rules';

const DEFAULT_RULES: ShiftRule[] = [
    MinRestRule,
    MaxWeeklyHoursRule,
    ConsecutiveDaysRule,
    CoverageRule,
    MinimumShiftDurationRule,
    OrphanedHoursRule
];

export class ShiftEngine {
    private rules: ShiftRule[];

    constructor(customRules?: ShiftRule[]) {
        this.rules = customRules || DEFAULT_RULES;
    }

    public validate(context: EngineContext): ValidationResult[] {
        let allErrors: ValidationResult[] = [];

        // Filter inactive rules if needed
        const activeRules = this.rules.filter(r => r.active);

        for (const rule of activeRules) {
            try {
                const errors = rule.validate(context);
                allErrors = [...allErrors, ...errors];
            } catch (error) {
                console.error(`ShiftEngine Error in rule ${rule.name}:`, error);
                allErrors.push({
                    ruleId: rule.id,
                    staffId: 0,
                    level: 'CRITICAL',
                    message: `Internal Engine Error: ${error}`,
                    date: new Date().toISOString().split('T')[0]
                });
            }
        }

        return allErrors;
    }

    public getRuleMetadata() {
        return this.rules.map(r => ({ id: r.id, name: r.name }));
    }
}
