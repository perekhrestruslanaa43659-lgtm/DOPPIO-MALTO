
function testMatch(staffSkill, taskStation) {
    // Current Logic
    const normalizeOld = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    // New Proposed Logic
    // Goal: "B/S" should match "B/S_2", "B/S V", "CDR_S" -> "CDR"
    const normalizeNew = (s) => {
        let norm = s.toLowerCase();
        // Remove common suffixes indicating variants or days
        // _2, _3 (numbers)
        // _s, _v (days?)
        // :s (seen in ACCGIU:S)
        //  s,  v (space followed by letter)

        // Strategy: splitting by common separators and taking the first chunk?
        // "B/S_2" -> "B/S"
        // "ACCGIU:S" -> "ACCGIU"

        // Regex to strip suffixes starting with non-word or underscore, followed by anything
        // But "B/S" has a slash which is non-word.

        // Let's try removing specific patterns from the end
        // Remove trailing _\d, _[a-z], :[a-z], \s[a-z]
        norm = norm.replace(/_[0-9]+$/, ''); // _2
        norm = norm.replace(/_[a-z]+$/, ''); // _s
        norm = norm.replace(/:[a-z0-9]+$/, ''); // :s
        norm = norm.replace(/\s[a-z0-9]+$/, ''); // V

        // Finally standarize
        return norm.replace(/[^a-z0-9]/g, '');
    };

    const oldMatch = normalizeOld(staffSkill) === normalizeOld(taskStation);
    const newMatch = normalizeNew(staffSkill) === normalizeNew(taskStation);

    console.log(`'${staffSkill}' vs '${taskStation}' -> OLD: ${oldMatch} | NEW: ${newMatch}`);
}

console.log("--- Testing Matching Logic ---");
testMatch("B/S", "B/S_2");
testMatch("B/S", "B/S V");
testMatch("B/S", "B/S S");
testMatch("CDR", "CDR_S");
testMatch("ACCGIU", "ACCGIU:S");
testMatch("BARSU", "BARSU");
testMatch("Acc Giu", "ACCGIU:S"); // Should match? 'accgiu' vs 'accgiu'
