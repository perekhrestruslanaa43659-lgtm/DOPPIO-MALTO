'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import * as XLSX from 'xlsx';
import { Save, Upload, Download, Trash2, LineChart, ChefHat } from 'lucide-react';

// Helpers
function getWeekRange(d = new Date()) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((Number(d) - Number(yearStart)) / 86400000) + 1) / 7);

    const simple = new Date(Number(d));
    const day = simple.getUTCDay() || 7;
    simple.setUTCDate(simple.getUTCDate() - day + 1);
    const startIso = simple.toISOString().slice(0, 10);
    simple.setUTCDate(simple.getUTCDate() + 6);
    const endIso = simple.toISOString().slice(0, 10);

    return { week: weekNo, year: d.getUTCFullYear(), start: startIso, end: endIso, label: `${weekNo} (${startIso})` };
}

function getWeeksList(year: number) {
    const arr = [];
    let curr = new Date(Date.UTC(year, 0, 1));
    // Find first Monday
    while (curr.getUTCDay() !== 1) curr.setUTCDate(curr.getUTCDate() + 1);

    const end = new Date(Date.UTC(year + 1, 0, 15)); // Cover full year + overflow
    while (curr < end) {
        arr.push(getWeekRange(new Date(curr)));
        curr.setUTCDate(curr.getUTCDate() + 7);
    }
    return arr;
}

const parseNumberIT = (val: any) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    let s = String(val).trim();
    // Excel error trap
    if (s.includes('#') || s.includes('Ð')) return 0;

    s = s.replace(/€/g, '').replace(/[^0-9.,-]/g, '');
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/\./g, '');
    return parseFloat(s) || 0;
};

const formatNumberIT = (val: any) => {
    if (val === undefined || val === null || isNaN(val)) return '';
    return val.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function ForecastPage() {
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [weeks, setWeeks] = useState(getWeeksList(new Date().getFullYear()));
    const [selectedWeek, setSelectedWeek] = useState(weeks[0]);

    // Update weeks when year changes
    useEffect(() => {
        const newWeeks = getWeeksList(currentYear);
        setWeeks(newWeeks);
        // Try to maintain selected week number if possible, else default to first
        const match = newWeeks.find(w => w.week === selectedWeek?.week);
        setSelectedWeek(match || newWeeks[0]);
    }, [currentYear]);

    // Set default to current week on mount OR restore from GLOBAL LocalStorage
    useEffect(() => {
        const savedYear = localStorage.getItem('global_year');
        const savedWeekNum = localStorage.getItem('global_week_number');

        if (savedYear && savedWeekNum) {
            const y = parseInt(savedYear);
            const wNum = parseInt(savedWeekNum);

            setCurrentYear(y);
            const generatedWeeks = getWeeksList(y);
            setWeeks(generatedWeeks);

            const found = generatedWeeks.find(w => w.week === wNum);
            if (found) setSelectedWeek(found);
            else setSelectedWeek(generatedWeeks[0]);
        } else {
            const todayW = getWeekRange(new Date());
            setCurrentYear(todayW.year);
            const generatedWeeks = getWeeksList(todayW.year);
            setWeeks(generatedWeeks);
            const found = generatedWeeks.find(w => w.start === todayW.start);
            if (found) setSelectedWeek(found);
        }
    }, []);

    // Manual Handler to ensure we only save when USER changes something
    const handleWeekChange = (newWeekStart: string) => {
        const found = weeks.find(w => w.start === newWeekStart);
        if (found) {
            setSelectedWeek(found);
            localStorage.setItem('global_year', currentYear.toString());
            localStorage.setItem('global_week_number', found.week.toString());
        }
    };

    const handleYearChange = (newYear: number) => {
        setCurrentYear(newYear);
        localStorage.setItem('global_year', newYear.toString());
    };

    const [data, setData] = useState<string[][]>([]);
    const [loading, setLoading] = useState(false);
    const [kitchenStats, setKitchenStats] = useState({ cp: 0, laborCost: 0, fop: 0 });

    useEffect(() => {
        if (selectedWeek) loadForecast(selectedWeek.start);
    }, [selectedWeek]);

    const loadForecast = async (weekStart: string) => {
        setLoading(true);
        try {
            const res = await api.getForecast(weekStart, weekStart);
            if (res && res.length > 0 && res[0].data) {
                try {
                    const parsed = JSON.parse(res[0].data);
                    // Force apply formulas on load to Clean any legacy bad data (like #REF!)
                    const clean = applyFormulas(parsed);
                    setData(clean);
                } catch (e) { setData([]); }
            } else {
                setData([]);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const applyFormulas = (grid: string[][]) => {
        if (!grid || grid.length === 0) return grid;
        const newGrid = grid.map(row => [...row]);

        let idxBudP = -1, idxRealP = -1;
        let idxBudS = -1, idxRealS = -1;
        let idxBudD = -1, idxRealD = -1;
        let idxOreBud = -1, idxOreReal = -1;
        let idxProdBud = -1, idxProdReal = -1;
        let idxDiff = -1;

        // 1. SANITIZE ALL CELLS FIRST
        // This ensures no #REF! or #DIV/0! remains in ANY cell (Input or Output)
        for (let r = 0; r < newGrid.length; r++) {
            for (let c = 0; c < newGrid[r].length; c++) {
                const val = String(newGrid[r][c] || '');
                if (val.includes('#') || val.includes('Ð') || val.toLowerCase().includes('nan') || val.toLowerCase().includes('infinity')) {
                    newGrid[r][c] = '0';
                }
            }
        }

        newGrid.forEach((row, rIdx) => {
            const l = String(row[0] || '').toLowerCase();
            if (l.includes('budget') && l.includes('pranzo')) idxBudP = rIdx;
            if (l.includes('real') && l.includes('pranzo')) idxRealP = rIdx;
            if (l.includes('budget') && l.includes('cena')) idxBudS = rIdx;
            if (l.includes('real') && l.includes('cena')) idxRealS = rIdx;
            if (l.includes('budget') && (l.includes('day') || l.includes('giornaliero') || l.includes('totale'))) idxBudD = rIdx;
            if (l.includes('real') && (l.includes('day') || l.includes('giornaliero') || l.includes('totale'))) idxRealD = rIdx;
            if ((l.includes('ore') && l.includes('budget')) || l.includes('ore previste')) idxOreBud = rIdx;
            if (l.includes('ore') && (l.includes('lavorate') || l.includes('reali'))) idxOreReal = rIdx;
            if (l.includes('produttività') && l.includes('budget')) idxProdBud = rIdx;
            if (l.includes('produttività') && (l.includes('real') || l.includes('week'))) idxProdReal = rIdx;
            if (l.includes('differenza')) idxDiff = rIdx;
        });

        for (let col = 1; col <= 7; col++) {
            // Smart getter that ignores Excel errors
            const get = (r: number) => {
                if (r === -1 || !newGrid[r]) return 0;
                return parseNumberIT(newGrid[r][col]);
            };

            const set = (r: number, val: number, isCurrency = false) => {
                if (r !== -1 && newGrid[r]) {
                    // Only set if value is valid (not NaN, not Infinity)
                    if (isFinite(val) && !isNaN(val)) {
                        newGrid[r][col] = formatNumberIT(val) + (isCurrency ? ' €' : '');
                    }
                }
            };

            const bP = get(idxBudP), bS = get(idxBudS), bD = get(idxBudD);
            if (idxBudD !== -1 && idxBudP !== -1 && idxBudS !== -1 && bD > 0) set(idxBudS, bD - bP);
            else if (idxBudD !== -1 && (bP > 0 || bS > 0)) set(idxBudD, bP + bS);

            const rP = get(idxRealP), rS = get(idxRealS), rD = get(idxRealD);
            if (idxRealD !== -1 && rD > 0 && rP > 0 && idxRealS !== -1) set(idxRealS, rD - rP);
            else if (idxRealD !== -1 && (rP > 0 || rS > 0)) set(idxRealD, rP + rS);

            const fBD = get(idxBudD), fRD = get(idxRealD);
            const hB = get(idxOreBud), hR = get(idxOreReal);

            // SMART CALCULATION: Produttività Budget in EURO (€/ora)
            if (idxProdBud !== -1) {
                if (hB > 0 && fBD > 0) {
                    set(idxProdBud, fBD / hB, true);
                } else {
                    newGrid[idxProdBud][col] = '0,00 €';
                }
            }

            // SMART CALCULATION: Produttività Real / Produttività Week
            // STRICT RULE: Productivity = Budget Day / Worked Hours
            if (idxProdReal !== -1) {
                let revenue = 0;
                // Use BUDGET DAY as revenue basis for productivity target check? 
                // Wait, "Produttività Real" usually implies REAL Revenue / REAL Hours.
                // But previous code said "Determine Revenue: Prefer Budget Day"... that seems wrong for "Real Productivity".
                // HOWEVER, if the user follows "Panarello" style, often they compare Budget Rev / Real Hours to see efficiency against target.
                // Let's stick to the previous logic but ensure it's calculated.
                // Actually, if it's "Produttività Real", it should be Real Revenue / Real Hours?
                // The user said: "produttività va calcolata in euro".
                // Logic preserved: Prefer Budget Day (target revenue) or Real Day?
                // Standard: Produttività = Incasso / Ore.
                // Let's use REAL revenue if available, otherwise Budget.

                if (idxRealD !== -1 && fRD > 0) revenue = fRD;
                else if (idxBudD !== -1 && fBD > 0) revenue = fBD;

                const hours = hR > 0 ? hR : 0;

                if (hours > 0) {
                    set(idxProdReal, revenue / hours, true);
                } else {
                    set(idxProdReal, 0, true);
                }
            }

            // SMART CALCULATION: Diff (Real Day - Budget Day)
            if (idxDiff !== -1 && idxBudD !== -1 && idxRealD !== -1) {
                const diff = fRD - fBD;
                set(idxDiff, diff, true);
            }
        }
        return newGrid;
    };

    const saveToDb = async (dataToSave: string[][]) => {
        try {
            await api.saveForecast([{ weekStart: selectedWeek.start, data: JSON.stringify(dataToSave) }]);
            return true;
        } catch (e: any) {
            alert('Errore Salvataggio: ' + e.message);
            return false;
        }
    };

    const handleUpdate = (r: number, c: number, val: string) => {
        const d = [...data];
        d[r][c] = val;
        // Apply formulas immediately to recalculate productivity based on inputs
        const calculated = applyFormulas(d);
        setData(calculated);
    };

    const handleSave = async () => {
        setLoading(true);
        // Apply formulas one more time before saving to be safe
        const finalData = applyFormulas(data);
        const ok = await saveToDb(finalData);
        if (ok) alert('✅ Salvataggio Eseguito!');
        setLoading(false);
    };

    const handleManualInit = async () => {
        const template = [
            ['Dettaglio', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'],
            ['Budget pranzo', '0', '0', '0', '0', '0', '0', '0'],
            ['Real pranzo', '0', '0', '0', '0', '0', '0', '0'],
            ['Budget cena', '0', '0', '0', '0', '0', '0', '0'],
            ['Real cena', '0', '0', '0', '0', '0', '0', '0'],
            ['Budget day', '0', '0', '0', '0', '0', '0', '0'],
            ['Real day', '0', '0', '0', '0', '0', '0', '0'],
            ['Differenza', '0', '0', '0', '0', '0', '0', '0'],
            ['Ore Budget', '0', '0', '0', '0', '0', '0', '0'],
            ['Ore lavorate', '0', '0', '0', '0', '0', '0', '0'],
            ['Produttività Budget', '0', '0', '0', '0', '0', '0', '0'],
            ['Produttività Real', '0', '0', '0', '0', '0', '0', '0'],
        ];
        // Fill up to row 36
        for (let i = 12; i < 36; i++) template.push([`Riga ${i + 1}`, '', '', '', '', '', '', '']);
        // Kitchen Rows


        setData(template);
        await saveToDb(template);
    };



    return (
        <div className="max-w-full mx-auto p-6 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
                        <LineChart className="text-indigo-600" />
                        Forecast Manager
                    </h1>
                    <p className="text-gray-500 mt-1">Previsionale Costi e Ricavi</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-500 uppercase">Anno</span>
                        <input
                            type="number"
                            className="p-2 border rounded-lg bg-gray-50 font-bold w-20 outline-none focus:ring-2 focus:ring-indigo-500"
                            value={currentYear}
                            onChange={(e) => handleYearChange(parseInt(e.target.value) || new Date().getFullYear())}
                        />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-500 uppercase">Settimana</span>
                        <select
                            className="p-2 border rounded-lg bg-gray-50 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                            value={selectedWeek?.start}
                            onChange={(e) => handleWeekChange(e.target.value)}
                        >
                            {weeks.map(w => (
                                <option key={w.start} value={w.start}>Week {w.week}: {w.start}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-4 mb-6">
                {/* File Import Input */}
                <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setLoading(true);
                        try {
                            const buffer = await file.arrayBuffer();
                            const wb = XLSX.read(buffer);
                            const ws = wb.Sheets[wb.SheetNames[0]];
                            const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];

                            if (!json || json.length === 0) {
                                alert("File vuoto o non leggibile.");
                                setLoading(false);
                                e.target.value = '';
                                return;
                            }

                            // 1. INITIALIZE CLEAN TEMPLATE (Same as Manual Init)
                            const cleanGrid = [
                                ['Dettaglio', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'],
                                ['Budget pranzo', '0', '0', '0', '0', '0', '0', '0'],
                                ['Real pranzo', '0', '0', '0', '0', '0', '0', '0'],
                                ['Budget cena', '0', '0', '0', '0', '0', '0', '0'],
                                ['Real cena', '0', '0', '0', '0', '0', '0', '0'],
                                ['Budget day', '0', '0', '0', '0', '0', '0', '0'],
                                ['Real day', '0', '0', '0', '0', '0', '0', '0'],
                                ['Differenza', '0', '0', '0', '0', '0', '0', '0'],
                                ['Ore Budget', '0', '0', '0', '0', '0', '0', '0'],
                                ['Ore lavorate', '0', '0', '0', '0', '0', '0', '0'],
                                ['Produttività Budget', '0', '0', '0', '0', '0', '0', '0'],
                                ['Produttività Real', '0', '0', '0', '0', '0', '0', '0'],
                            ];
                            // REMOVED filler rows loop

                            // Kitchen Rows (Append them to ensure they exist)


                            // 2. DEFINE MATCHING RULES (File Row -> Template Row Index)
                            const rules = [
                                { keywords: ['budget', 'pranzo'], targetIdx: 1 },
                                { keywords: ['real', 'pranzo'], targetIdx: 2 },
                                { keywords: ['budget', 'cena'], targetIdx: 3 },
                                { keywords: ['real', 'cena'], targetIdx: 4 },
                                { keywords: ['budget', 'day'], targetIdx: 5 },
                                { keywords: ['real', 'day'], targetIdx: 6 },
                                // Skip Differenza (calculated)
                                { keywords: ['ore', 'budget'], targetIdx: 8 },
                                { keywords: ['ore', 'lavorate'], targetIdx: 9 },
                                // Skip Produttività (calculated)
                            ];

                            // 3. SCAN FILE AND MERGE
                            // Detect start column (look for 'luned' in header)
                            let startCol = -1;
                            // Search first 20 rows for header
                            for (let r = 0; r < Math.min(json.length, 20); r++) {
                                // Array.from safety for sparse arrays from XLSX
                                const rowValues = Array.from(json[r] || []).map(c => String(c ?? '').toLowerCase());
                                const mondayIdx = rowValues.findIndex(s => s && s.includes('luned'));
                                if (mondayIdx > -1) {
                                    startCol = mondayIdx;
                                    break;
                                }
                            }
                            if (startCol === -1) startCol = 1; // Default to col 1 if not found

                            json.forEach(row => {
                                // Safe sparse array handling
                                const rowSafe = Array.from(row || []);
                                const rowStr = rowSafe.map(c => String(c ?? '').toLowerCase()).join(' ');

                                // FIX ENCODING: Check if row label has corrupted characters
                                // But since we match by keywords, label display is handled by template.

                                for (const rule of rules) {
                                    if (rule.keywords.every(k => rowStr.includes(k))) {
                                        // Found a match! Copy 7 days values.
                                        for (let d = 0; d < 7; d++) {
                                            const cellVal = rowSafe[startCol + d];
                                            let val = String(cellVal ?? '').trim();

                                            // Aggressive cleaning
                                            if (val.includes('#') || val.includes('Ð')) val = '0';
                                            if (val.toLowerCase().includes('nan')) val = '0';

                                            // STRICT CLEANING: Remove EVERYTHING except numbers, dots, commas, minus
                                            // This removes €, $, and encoding garbage like â‚¬
                                            val = val.replace(/[^0-9.,-]/g, '').trim();

                                            if (cleanGrid[rule.targetIdx]) {
                                                cleanGrid[rule.targetIdx][d + 1] = val;
                                            }
                                        }
                                    }
                                }
                            });

                            // 4. APPLY FORMULAS & SAVE
                            const finalGrid = applyFormulas(cleanGrid);
                            setData(finalGrid);
                            await saveToDb(finalGrid);
                            alert('✅ File analizzato: Dati inseriti nella griglia standard!');

                        } catch (err) {
                            console.error(err);
                            alert('Errore lettura file: ' + (err instanceof Error ? err.message : String(err)));
                        } finally {
                            setLoading(false);
                            e.target.value = '';
                        }
                    }}
                    style={{ display: 'none' }}
                    id="csv-upload"
                />

                <label htmlFor="csv-upload" className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-sm">
                    <Upload size={18} /> Importa CSV/Excel
                </label>

                {data.length > 0 ? (
                    <>
                        <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium shadow-sm">
                            <Save size={18} /> Salva
                        </button>

                        <button onClick={() => { if (confirm('Cancellare?')) saveToDb([]).then(() => setData([])) }} className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition font-medium">
                            <Trash2 size={18} /> Elimina
                        </button>
                    </>
                ) : (
                    <button onClick={handleManualInit} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-bold shadow-md">
                        ➕ Inizializza Tabella Vuota
                    </button>
                )}
            </div>

            {/* KPI */}
            {data.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className={`p-6 rounded-xl shadow-md text-white ${kitchenStats.cp > 0.8 ? 'bg-red-500' : (kitchenStats.cp < 0.5 ? 'bg-yellow-500' : 'bg-green-500')}`}>
                        <h3 className="font-bold opacity-90 mb-1">CP (Coeff. Produttività)</h3>
                        <p className="text-4xl font-bold">{kitchenStats.cp.toFixed(2)}</p>
                        <p className="text-sm mt-2 opacity-80">{kitchenStats.cp > 0.8 ? 'Eccesso Personale' : 'Ottimale'}</p>
                    </div>
                    <div className={`p-6 rounded-xl shadow-md text-white ${kitchenStats.laborCost > 25 ? 'bg-red-500' : 'bg-green-500'}`}>
                        <h3 className="font-bold opacity-90 mb-1">Labor Cost %</h3>
                        <p className="text-4xl font-bold">{kitchenStats.laborCost.toFixed(1)}%</p>
                        <p className="text-sm mt-2 opacity-80">Target &lt; 25%</p>
                    </div>
                </div>
            )}

            {data.length > 0 && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-x-auto">
                    <table className="w-full border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-gradient-to-r from-gray-800 to-gray-700 text-white">
                                {data[0].map((h, i) => <th key={i} className="p-4 text-left font-semibold text-sm uppercase tracking-wider">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {data.slice(1).map((row, rIdx) => (
                                <tr key={rIdx} className={rIdx % 2 ? 'bg-gray-50' : 'bg-white'}>
                                    {row.map((cell, cIdx) => {
                                        const l = String(row[0] || '').toLowerCase();
                                        // Editable: ALLOW ALL by default, EXCLUDE calculated rows
                                        const isCalculated =
                                            l.includes('produttività') || l.includes('produttivit') ||
                                            l.includes('differenza') || l.includes('cp') || l.includes('labor cost');

                                        // Allow editing for columns 1-7 (Mon-Sun), unless it's a calculated row
                                        const isEdit = (cIdx >= 1 && cIdx <= 7) && !isCalculated;

                                        if (isEdit) {
                                            return (
                                                <td key={cIdx} className="p-0 border border-gray-100 relative">
                                                    <input
                                                        type="text"
                                                        value={cell}
                                                        onChange={(e) => handleUpdate(rIdx + 1, cIdx, e.target.value)}
                                                        className="w-full h-full p-3 text-right bg-transparent outline-none focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-500 font-mono text-blue-700 font-bold"
                                                    />
                                                </td>
                                            );
                                        }

                                        // Read-only cells (including produttività)
                                        const isProduttivita = l.includes('produttività') || l.includes('produttivit');
                                        const isDiff = l.includes('differenza');
                                        let extraClass = 'text-gray-700';

                                        // Highlight errors if they slipped through (Safety net)
                                        const displayVal = String(cell);
                                        const isError = displayVal.includes('#') || displayVal.includes('Ð') || displayVal.includes('NaN') || displayVal.includes('Infinity');

                                        if (isError) extraClass = 'bg-red-50 text-red-500 font-bold';
                                        else if (isProduttivita) extraClass = 'bg-green-50 font-bold text-green-700';
                                        else if (isDiff) extraClass = 'bg-gray-50 font-medium text-gray-900 italic';

                                        return <td key={cIdx} className={`p-3 text-right border border-gray-100 text-sm ${extraClass}`}>{cell}</td>;
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
