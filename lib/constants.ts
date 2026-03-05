
export const DEFAULT_STATIONS = [
    // Sala / Bar (from CSV)
    'BARGIU', 'BARSU', 'ACCSU',
    'CDR', 'CDR_V', 'CDR_S', 'CDR_D',
    'ACCGIU_V', 'ACCGIU:S', 'ACCGIU:_D',
    'B/S', 'B/S_2', 'B/S_V', 'B/S_S', 'B/S_D',
    'SCARICO', 'PASS',
    // Cucina
    'Pira', 'Burger', 'Fritti', 'Dolci/Ins', 'Preparazione',
    'Lavaggio', 'Lavaggio Cappa', 'Pulizia', 'SCARICO_Cucina'
];
<<<<<<< Updated upstream
=======

// Station classification for role-based filtering
export const SALA_KEYWORDS = [
    'sala', 'bar', 'accgiu', 'cdr', 'b/s', 'pass', 'scarico'
];

export const CUCINA_KEYWORDS = [
    'cucina', 'pira', 'burger', 'fritti', 'dolci', 'preparazione',
    'lavaggio', 'plonge', 'cuoco', 'chef', 'griglia'
];

/**
 * Classifies a station as SALA, CUCINA, or BOTH
 * Used to prevent cross-department assignments
 */
export function getStationDepartment(station: string): 'SALA' | 'CUCINA' | 'BOTH' {
    const normalized = station.toLowerCase().replace(/[^a-z]/g, '');

    // Check for explicit SALA keywords
    const isSala = SALA_KEYWORDS.some(keyword => normalized.includes(keyword.replace(/[^a-z]/g, '')));

    // Check for explicit CUCINA keywords
    const isCucina = CUCINA_KEYWORDS.some(keyword => normalized.includes(keyword.replace(/[^a-z]/g, '')));

    // If it matches both or neither, it's available to both departments
    if ((isSala && isCucina) || (!isSala && !isCucina)) {
        return 'BOTH';
    }

    return isSala ? 'SALA' : 'CUCINA';
}

/**
 * Checks if a staff member can work at a given station based on their assigned positions
 */
export function canStaffWorkStation(staffPostazioni: string[], taskStation: string): boolean {
    const taskDept = getStationDepartment(taskStation);

    // If task is available to both departments, anyone can do it
    if (taskDept === 'BOTH') return true;

    // Check if staff has at least one position in the same department
    const staffDepartments = staffPostazioni.map(p => getStationDepartment(p));

    // Staff can work the task if they have ANY position in the same department
    return staffDepartments.includes(taskDept) || staffDepartments.includes('BOTH');
}
>>>>>>> Stashed changes
