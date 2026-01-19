'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import * as XLSX from 'xlsx';
import { Save, Upload, Download, Trash2, LineChart, ChefHat, ChevronLeft, ChevronRight, Clock, Target, DollarSign, Activity } from 'lucide-react'; // Added icons

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

// Added calcHours helper (same as Calendar)
const calcHours = (start: string | null, end: string | null) => {
    if (!start || !end) return 0;
    const cleanTime = (time: string) => {
        const cleaned = time.trim().split(' ')[0];
        return cleaned;
    };
    const startClean = cleanTime(start);
    const endClean = cleanTime(end);
    if (!/^\d{1,2}:\d{2}$/.test(startClean) || !/^\d{1,2}:\d{2}$/.test(endClean)) return 0;
    const [h1, m1] = startClean.split(':').map(Number);
    const [h2, m2] = endClean.split(':').map(Number);
    if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;
    let diff = (h2 + m2 / 60) - (h1 + m1 / 60);
    if (diff < 0) diff += 24;
    return Math.round(diff * 100) / 100;
};

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
    const [plannedHours, setPlannedHours] = useState(0);

    const [estimatedCost, setEstimatedCost] = useState(0);
    const [isAutoSaving, setIsAutoSaving] = useState(false);
    const [debugLogs, setDebugLogs] = useState<string[]>([]); // [NEW] Debug Logs

    const addLog = (msg: string) => {
        const timestamp = new Date().toLocaleTimeString();
        const logMsg = `[${timestamp}] ${msg}`;
        setDebugLogs(prev => [logMsg, ...prev].slice(0, 10));
        console.log(`📋 FORECAST LOG: ${logMsg}`);
    };

    const autoSaveTimeout = React.useRef<NodeJS.Timeout | null>(null);
    const abortControllerRef = React.useRef<AbortController | null>(null);
    const loadCounterRef = React.useRef(0);

    useEffect(() => {
        if (selectedWeek) {
            loadCounterRef.current++;
            const loadId = loadCounterRef.current;
            console.log(`\n🔄 === WEEK CHANGE EFFECT #${loadId} ===`);
            console.log(`   New Week: ${selectedWeek.start} (Week ${selectedWeek.week})`);
            addLog(`👀 Week Changed -> ${selectedWeek.start} (Week ${selectedWeek.week})`);
            loadForecast(selectedWeek, loadId);
        }
    }, [selectedWeek]);

    const loadForecast = async (weekObj: any, loadId?: number) => {
        const currentLoadId = loadId || loadCounterRef.current;
        console.log(`\n📥 === LOAD FORECAST START (ID: ${currentLoadId}) ===`);
        console.log(`   Week: ${weekObj.start}`);
        console.log(`   Current selectedWeek: ${selectedWeek?.start}`);

        // Cancel previous fetch if exists
        if (abortControllerRef.current) {
            console.log(`🛑 Aborting previous fetch...`);
            abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        setLoading(true);
        // Reset stats initially to avoid stale data
        setPlannedHours(0);
        setEstimatedCost(0);

        try {
            addLog(`🔄 Loading Forecast: ${weekObj.start}`);

            // 1. Fetch Forecast Data (Primary)
            try {
                console.log(`🌐 Fetching forecast data...`);
                addLog(`🐛 Calling API with: start="${weekObj.start}", end="${weekObj.end}"`);
                const res = await api.getForecast(weekObj.start, weekObj.start);

                // Check if aborted
                if (signal.aborted) {
                    console.log(`⏹️ Fetch aborted for ${weekObj.start}`);
                    return;
                }

                addLog(`📡 API Response: ${res ? res.length : 0} records`);
                console.log(`   Response:`, res);

                if (res && res.length > 0 && res[0].data) {
                    addLog(`✅ Data found! ID: ${res[0].id}`);
                    console.log(`   Data ID: ${res[0].id}, Week: ${res[0].weekStart}`);

                    // RACE CONDITION CHECK: Ensure we are still looking at the same week
                    if (weekObj.start !== selectedWeek.start) {
                        console.log(`🛑 RACE CONDITION: Ignoring load for ${weekObj.start}, current view is ${selectedWeek.start}`);
                        addLog(`🛑 Ignored load for ${weekObj.start} because view changed to ${selectedWeek.start}`);
                        return;
                    }

                    const parsed = JSON.parse(res[0].data);
                    addLog(`📊 Rows: ${parsed.length}`);
                    console.log(`   Parsing ${parsed.length} rows...`);
                    const clean = applyFormulas(parsed);
                    console.log(`✅ Setting data in state (${clean.length} rows)`);
                    setData(clean);
                } else {
                    if (weekObj.start !== selectedWeek.start) {
                        console.log(`🛑 RACE CONDITION: Ignoring empty load for ${weekObj.start}`);
                        addLog(`🛑 Ignored empty load for ${weekObj.start} because view changed to ${selectedWeek.start}`);
                        return;
                    }
                    console.log(`⚠️ No data found for week ${weekObj.start}`);
                    addLog(`⚠️ No data found for this week`);
                    setData([]);
                }
            } catch (err) {
                if (signal.aborted) {
                    console.log(`⏹️ Fetch error ignored (aborted)`);
                    return;
                }
                const msg = err instanceof Error ? err.message : String(err);
                console.error(`❌ Forecast fetch error:`, err);
                addLog(`❌ Error fetching: ${msg}`);
                // Don't clear data here if we want to show error, but usually empty is safer
                setData([]);
            }

            // 2. Fetch Schedule Data (Secondary - for KPIs)
            try {
                const assignments = await api.getSchedule(weekObj.start, weekObj.end);
                let totalH = 0;
                let totalC = 0;
                if (Array.isArray(assignments)) {
                    assignments.forEach((a: any) => {
                        const sT = a.start_time || a.shiftTemplate?.oraInizio;
                        const eT = a.end_time || a.shiftTemplate?.oraFine;
                        if (sT && eT) {
                            const h = calcHours(sT, eT);
                            totalH += h;
                            const rate = a.staff?.costoOra || 0;
                            totalC += h * rate;
                        }
                    });
                }
                setPlannedHours(totalH);
                setEstimatedCost(totalC);
            } catch (err) {
                console.error("Error loading schedule for KPIs:", err);
                // KPIs will just remain 0, but Forecast table is visible
            }

        } catch (error) {
            if (signal.aborted) {
                console.log(`⏹️ Load aborted for ${weekObj.start}`);
                return;
            }
            console.error(`❌ Critical Load Error for ${weekObj.start}:`, error);
        } finally {
            if (!signal.aborted) {
                console.log(`📥 === LOAD FORECAST END (ID: ${currentLoadId}) ===\n`);
                setLoading(false);
            }
        }
    };

    // [NEW] KPI Calculation Effect
    useEffect(() => {
        calculateStats();
    }, [data, plannedHours]); // Re-run when data or hours change, but we need assignments..
    // Actually, calculateStats needs 'assignments' which are local to loadForecast scope?
    // We should store assignments in state or ref if we want to recalc live.
    // For simplicity, let's store 'totalLaborCost' in state and update it in loadForecast.

    // Better: Update loadForecast to calculate cost immediately and set it.

    /* 
     * UPDATED loadForecast to calculate cost 
     */


    // ... wait, I cannot easily replace the whole function if I don't see it all. 
    // I will use a separate state 'laborCostTotal' set during loadForecast.
    // So I need to add state first.


    const calculateStats = () => {
        if (!data || data.length === 0) return;

        let totalRevenue = 0;
        data.forEach(row => {
            const label = String(row[0] || '').toLowerCase();
            // Use Budget Day for forecasting
            if (label.includes('budget') && (label.includes('day') || label.includes('totale'))) {
                for (let i = 1; i <= 7; i++) totalRevenue += parseNumberIT(row[i]);
            }
        });

        const lcPerc = totalRevenue > 0 ? (estimatedCost / totalRevenue) * 100 : 0;
        // CP = Labor Cost Ratio (0.25 for 25%).
        const cp = totalRevenue > 0 ? (estimatedCost / totalRevenue) : 0;

        setKitchenStats({
            cp: cp,
            laborCost: lcPerc,
            fop: 0
        });
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

            const bP = get(idxBudP), bS = get(idxBudS); // bD = get(idxBudD);
            // AGGRESSIVE CORRECTION: Always calculate Day = Lunch + Dinner if Lunch/Dinner exist
            if (idxBudD !== -1 && idxBudP !== -1 && idxBudS !== -1) {
                set(idxBudD, bP + bS);
            }

            const rP = get(idxRealP), rS = get(idxRealS); // rD = get(idxRealD);
            // AGGRESSIVE CORRECTION: Always calculate Real Day = Real Lunch + Real Dinner
            if (idxRealD !== -1 && idxRealP !== -1 && idxRealS !== -1) {
                set(idxRealD, rP + rS);
            }

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

    const saveToDb = async (dataToSave: string[][], overrideWeekStart?: string) => {
        try {
            const target = overrideWeekStart || selectedWeek.start;
            const payload = JSON.stringify(dataToSave);
            const payloadSize = payload.length;

            console.log(`\n💾 === SAVE FORECAST START ===`);
            console.log(`   Week: ${target}`);
            console.log(`   Rows: ${dataToSave.length}`);
            console.log(`   Payload size: ${payloadSize} bytes`);

            addLog(`📤 Saving forecast for week ${target}, payload size: ${payloadSize} bytes`);

            const response = await api.saveForecast([{ weekStart: target, data: payload }]);

            console.log(`✅ Save response:`, response);
            addLog(`✅ API reported: success`);
            console.log(`💾 === SAVE FORECAST END ===\n`);
            return true;
        } catch (e: any) {
            console.error(`\n❌ === SAVE FORECAST ERROR ===`);
            console.error(`   Error:`, e);
            console.error(`   Message: ${e.message || String(e)}`);
            console.error(`===============================\n`);
            addLog(`❌ SAVE ERROR: ${e.message || String(e)}`);
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

        // [NEW] Auto-Save Logic (Debounce 2s)
        if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
        setIsAutoSaving(true);
        autoSaveTimeout.current = setTimeout(async () => {
            await saveToDb(calculated);
            setIsAutoSaving(false);
        }, 2000);
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

                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-gray-500">Previsionale Costi e Ricavi</p>
                        {isAutoSaving && <span className="text-xs text-orange-500 font-bold animate-pulse">Salvataggio...</span>}
                        {!isAutoSaving && data.length > 0 && <span className="text-xs text-green-600 font-bold">Salvato</span>}
                    </div>
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
                        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border">
                            <button
                                onClick={() => {
                                    const idx = weeks.findIndex(w => w.week === selectedWeek.week);
                                    if (idx > 0) handleWeekChange(weeks[idx - 1].start);
                                }}
                                className="p-1 hover:bg-white rounded shadow-sm text-gray-600 disabled:opacity-30"
                                disabled={weeks.findIndex(w => w.week === selectedWeek.week) <= 0}
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <input
                                type="number"
                                className="w-12 text-center bg-transparent font-extrabold text-lg outline-none text-indigo-700"
                                value={selectedWeek?.week || ''}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (val >= 1 && val <= 53) {
                                        const found = weeks.find(w => w.week === val);
                                        if (found) handleWeekChange(found.start);
                                    }
                                }}
                            />
                            <button
                                onClick={() => {
                                    const idx = weeks.findIndex(w => w.week === selectedWeek.week);
                                    if (idx < weeks.length - 1) handleWeekChange(weeks[idx + 1].start);
                                }}
                                className="p-1 hover:bg-white rounded shadow-sm text-gray-600 disabled:opacity-30"
                                disabled={weeks.findIndex(w => w.week === selectedWeek.week) >= weeks.length - 1}
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>
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

                            // Detect week BEFORE processing
                            let targetWeek = selectedWeek;
                            let detectedWeekStart = '';

                            for (let r = 0; r < Math.min(json.length, 20); r++) {
                                const rowSafe = Array.from(json[r] || []);
                                const rowStr = rowSafe.map(c => String(c ?? '').toLowerCase()).join(' ');

                                const weekMatch = rowStr.match(/week\s+(\d+)/i);
                                if (weekMatch) {
                                    const wNum = parseInt(weekMatch[1]);
                                    const matchingWeek = weeks.find(w => w.week === wNum);
                                    if (matchingWeek) { detectedWeekStart = matchingWeek.start; break; }
                                }
                                const dateMatch = rowStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
                                if (dateMatch) {
                                    const isoDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
                                    const matchingWeek = weeks.find(w => w.start === isoDate);
                                    if (matchingWeek) { detectedWeekStart = matchingWeek.start; break; }
                                }
                            }


                            if (detectedWeekStart && detectedWeekStart !== selectedWeek.start) {
                                const detectedWeekNum = weeks.find(w => w.start === detectedWeekStart)?.week || '?';
                                alert(`❌ ERRORE: Questo file è per la settimana ${detectedWeekNum} (${detectedWeekStart}), ma sei sulla settimana ${selectedWeek.week} (${selectedWeek.start}).\n\nCambia settimana prima di importare il file.`);
                                setLoading(false);
                                e.target.value = '';
                                return;
                            }


                            let matchedCount = 0;

                            json.forEach(row => {
                                // Safe sparse array handling
                                const rowSafe = Array.from(row || []);

                                // CRITICAL FIX: Only check FIRST COLUMN (label) for matching
                                // This prevents matching percentage rows or other data rows
                                const firstCol = String(rowSafe[0] ?? '').toLowerCase().trim();

                                // Skip empty first columns
                                if (!firstCol) return;

                                // FIX ENCODING: Check if row label has corrupted characters
                                // But since we match by keywords, label display is handled by template.

                                for (const rule of rules) {
                                    // Match only if ALL keywords are in the FIRST COLUMN
                                    if (rule.keywords.every(k => firstCol.includes(k))) {
                                        matchedCount++;
                                        // Found a match! Copy 7 days values.
                                        for (let d = 0; d < 7; d++) {
                                            const cellVal = rowSafe[startCol + d];
                                            let val = String(cellVal ?? '').trim();

                                            // Aggressive cleaning
                                            if (val.includes('#') || val.includes('Ð')) val = '0';
                                            if (val.toLowerCase().includes('nan')) val = '0';

                                            // STRICT CLEANING: Remove EVERYTHING except numbers, dots, commas, minus, spaces
                                            // This removes €, $, and encoding garbage like â‚¬
                                            val = val.replace(/[^0-9.,-\s]/g, '').trim();

                                            // Remove spaces (used as thousands separator in some formats)
                                            val = val.replace(/\s+/g, '');

                                            // ITALIAN FORMAT CONVERSION - IMPROVED
                                            // Italian: 5.500,00 → Standard: 5500.00
                                            // Strategy: If has comma, split on comma
                                            //   - Part before comma: remove all dots (thousands separators)
                                            //   - Part after comma: keep as decimals
                                            if (val.includes(',')) {
                                                const parts = val.split(',');
                                                const integerPart = parts[0].replace(/\./g, ''); // Remove dots from integer part
                                                const decimalPart = parts[1] || ''; // Keep decimal part as-is
                                                val = integerPart + '.' + decimalPart;
                                            }
                                            // else: already in standard format (no comma, dots are decimals)

                                            if (cleanGrid[rule.targetIdx]) {
                                                cleanGrid[rule.targetIdx][d + 1] = val;
                                            }
                                        }
                                        break; // Stop after first match to avoid double-matching
                                    }
                                }
                            });

                            if (matchedCount === 0) {
                                alert("⚠️ ATTENZIONE: Nessuna riga riconosciuta nel file!\nControlla che il file contenga le voci corrette (es. 'Budget Pranzo', 'Real Cena', ecc).");
                                setLoading(false);
                                e.target.value = '';
                                return;
                            }

                            // 4. APPLY FORMULAS & SAVE TO TARGET WEEK
                            const finalGrid = applyFormulas(cleanGrid);

                            // Save to DB *FIRST*
                            addLog(`Saving ${matchedCount} matched rows to week ${targetWeek.start}...`);
                            const saved = await saveToDb(finalGrid, targetWeek.start);

                            if (saved) addLog("✅ Save API reported Success.");
                            else addLog("❌ Save API reported Failure.");

                            // Small delay to ensure DB write completes before reload
                            await new Promise(resolve => setTimeout(resolve, 300));

                            // If target week is different, switch view AND update persistence
                            if (targetWeek.start !== selectedWeek.start) {
                                setSelectedWeek(targetWeek);
                                // PERSISTENCE FIX: Ensure we save the new location so reload doesn't revert
                                localStorage.setItem('global_year', targetWeek.year.toString());
                                localStorage.setItem('global_week_number', targetWeek.week.toString());

                                alert(`✅ Importate ${matchedCount} righe nella settimana del ${targetWeek.week}.\nCambio visualizzazione...`);
                            } else {
                                setData(finalGrid);
                                alert(`✅ Dati importati correttamente! (${matchedCount} righe aggiornate)`);
                            }

                        } catch (err) {
                            console.error(err);
                            addLog(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
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

                        <button onClick={async () => {
                            if (confirm('Sei sicuro di voler ELIMINARE TUTTO il forecast di questa settimana?')) {
                                try {
                                    setLoading(true);
                                    await api.deleteForecast(selectedWeek.start);
                                    setData([]); // Clear UI immediately
                                    alert("✅ Forecast Eliminato.");
                                } catch (e: any) {
                                    alert("Errore eliminazione: " + e.message);
                                } finally {
                                    setLoading(false);
                                }
                            }
                        }} className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition font-medium">
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
            {
                data.length > 0 && (
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
                )
            }

            {
                data.length > 0 && (
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
                )
            }

            {/* [NEW] SUMMARY SECTION */}
            {
                data.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
                        {(() => {
                            // Calculate Totals using logic similar to applyFormulas
                            let budgetRev = 0;
                            let budgetHours = 0;

                            data.forEach(row => {
                                const label = String(row[0] || '').toLowerCase();
                                if (label.includes('budget') && (label.includes('day') || label.includes('totale'))) {
                                    // Sum columns 1-7
                                    for (let i = 1; i <= 7; i++) budgetRev += parseNumberIT(row[i]);
                                }
                                if ((label.includes('ore') && label.includes('budget'))) {
                                    for (let i = 1; i <= 7; i++) budgetHours += parseNumberIT(row[i]);
                                }
                            });

                            const productivity = budgetHours > 0 ? budgetRev / budgetHours : 0;

                            const Card = ({ title, value, icon: Icon, color, subText }: any) => (
                                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 relative overflow-hidden">
                                    <div className={`absolute right-4 top-4 p-2 rounded-lg opacity-10 ${color}`}>
                                        <Icon size={32} />
                                    </div>
                                    <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-2">{title}</h3>
                                    <div className="text-3xl font-extrabold text-gray-800 tracking-tight">{value}</div>
                                    {subText && <div className="text-xs text-gray-400 mt-2 font-medium">{subText}</div>}
                                </div>
                            );

                            return (
                                <>
                                    <Card
                                        title="Budget Fatturato"
                                        value={`€ ${formatNumberIT(budgetRev)}`}
                                        icon={DollarSign}
                                        color="bg-emerald-500 text-emerald-600"
                                        subText="Totale previsionale settimanale"
                                    />
                                    <Card
                                        title="Budget Ore"
                                        value={`${formatNumberIT(budgetHours)} h`}
                                        icon={Clock}
                                        color="bg-blue-500 text-blue-600"
                                        subText="Totale ore stimate"
                                    />
                                    <Card
                                        title="Ore Pianificate"
                                        value={`${formatNumberIT(plannedHours)} h`}
                                        icon={Target}
                                        color="bg-violet-500 text-violet-600"
                                        subText="Dal calendario effettivo"
                                    />
                                    <Card
                                        title="Produttività Media"
                                        value={`€ ${formatNumberIT(productivity)}`}
                                        icon={Activity}
                                        color="bg-orange-500 text-orange-600"
                                        subText="Budget Fatturato / Budget Ore"
                                    />
                                </>
                            );
                        })()}
                    </div>
                )
            }

            {/* DEBUG LOGS */}
            <div className="mt-8 p-4 bg-gray-900 rounded-lg text-xs font-mono text-green-400 overflow-y-auto max-h-40 border border-gray-700 shadow-inner">
                <div className="font-bold border-b border-gray-700 pb-2 mb-2 flex justify-between">
                    <span>SYSTEM LOGS (Debug Mode)</span>
                    <span className="opacity-50">v1.2</span>
                </div>
                {debugLogs.length === 0 ? <span className="opacity-50">Pronto. In attesa di caricamento file...</span> : debugLogs.map((l, i) => (
                    <div key={i} className="mb-1 border-b border-gray-800 pb-1 last:border-0">{l}</div>
                ))}
            </div>
        </div >
    );
}
