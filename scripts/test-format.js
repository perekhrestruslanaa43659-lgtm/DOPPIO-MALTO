// Test formatNumberIT
const formatNumberIT = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '';
    return val.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

console.log("=== TEST FORMAT NUMBER IT ===\n");
console.log("-1900 →", formatNumberIT(-1900));
console.log("5500 →", formatNumberIT(5500));
console.log("500 →", formatNumberIT(500));
console.log("-190000 →", formatNumberIT(-190000));
