// Test parsing formato italiano
const testValues = [
    "€ 2.700,00",
    "5.500,00€",
    "€ 1.800,00",
    "2.500,00€",
];

console.log("=== TEST PARSING FORMATO ITALIANO ===\n");

testValues.forEach(original => {
    let val = original;

    // STRICT CLEANING: Remove EVERYTHING except numbers, dots, commas, minus, spaces
    val = val.replace(/[^0-9.,-\s]/g, '').trim();

    // Remove spaces
    val = val.replace(/\s+/g, '');

    // ITALIAN FORMAT CONVERSION - IMPROVED
    if (val.includes(',')) {
        const parts = val.split(',');
        const integerPart = parts[0].replace(/\./g, ''); // Remove dots from integer part
        const decimalPart = parts[1] || ''; // Keep decimal part as-is
        val = integerPart + '.' + decimalPart;
    }

    console.log(`"${original}" → "${val}"`);
});

console.log("\n=== EXPECTED RESULTS ===");
console.log('"€ 2.700,00" → "2700.00"');
console.log('"5.500,00€" → "5500.00"');
console.log('"€ 1.800,00" → "1800.00"');
console.log('"2.500,00€" → "2500.00"');
