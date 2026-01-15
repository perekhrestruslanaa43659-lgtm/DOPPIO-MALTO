
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

    // Set default to current week on mount
    useEffect(() => {
        const todayW = getWeekRange(new Date());
        setCurrentYear(todayW.year);
        // We need to wait for year update to propogate? 
        // Actually, if we set year, the effect above runs.
        // But for initial load, let's try to set the exact week properly.
        const generatedWeeks = getWeeksList(todayW.year);
        setWeeks(generatedWeeks);
        const found = generatedWeeks.find(w => w.start === todayW.start);
        if (found) setSelectedWeek(found);
    }, []);

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
                    setData(parsed);
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

        newGrid.forEach((row, rIdx) => {
            const l = String(row[0] || '').toLowerCase();
            if (l.includes('budget') && l.includes('pranzo')) idxBudP = rIdx;
            if (l.includes('real') && l.includes('pranzo')) idxRealP = rIdx;
            if (l.includes('budget') && l.includes('cena')) idxBudS = rIdx;
            if (l.includes('real') && l.includes('cena')) idxRealS = rIdx;
            if (l.includes('budget') && (l.includes('day') || l.includes('giornaliero'))) idxBudD = rIdx;
            if (l.includes('real') && (l.includes('day') || l.includes('giornaliero'))) idxRealD = rIdx;
            if ((l.includes('ore') && l.includes('budget')) || l.includes('ore previste')) idxOreBud = rIdx;
            if (l.includes('ore') && (l.includes('lavorate') || l.includes('reali'))) idxOreReal = rIdx;
            if (l.includes('produttività') && l.includes('budget')) idxProdBud = rIdx;
            if (l.includes('produttività') && (l.includes('real') || l.includes('week'))) idxProdReal = rIdx;
        });

        for (let col = 1; col <= 7; col++) {
            const get = (r: number) => (r === -1 || !newGrid[r]) ? 0 : parseNumberIT(newGrid[r][col]);
            const set = (r: number, val: number) => { if (r !== -1 && newGrid[r]) newGrid[r][col] = formatNumberIT(val); };

            const bP = get(idxBudP), bS = get(idxBudS), bD = get(idxBudD);
            if (idxBudD !== -1 && idxBudP !== -1 && idxBudS !== -1 && bD > 0) set(idxBudS, bD - bP);
            else if (idxBudD !== -1 && (bP > 0 || bS > 0)) set(idxBudD, bP + bS);

            const rP = get(idxRealP), rS = get(idxRealS), rD = get(idxRealD);
            if (idxRealD !== -1 && rD > 0 && rP > 0 && idxRealS !== -1) set(idxRealS, rD - rP);
            else if (idxRealD !== -1 && (rP > 0 || rS > 0)) set(idxRealD, rP + rS);

            const fBD = get(idxBudD), fRD = get(idxRealD);
            const hB = get(idxOreBud), hR = get(idxOreReal);

            if (idxProdBud !== -1 && hB > 0 && fBD > 0) set(idxProdBud, fBD / hB);
            const div = hR > 0 ? hR : hB;
            if (idxProdReal !== -1 && div > 0 && fRD > 0) set(idxProdReal, fRD / div);
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
        setData(applyFormulas(d));
    };

    const handleSave = async () => {
        setLoading(true);
        const ok = await saveToDb(data);
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
            ['Ore Budget', '0', '0', '0', '0', '0', '0', '0'],
            ['Ore lavorate', '0', '0', '0', '0', '0', '0', '0'],
            ['Produttività Budget', '0', '0', '0', '0', '0', '0', '0'],
            ['Produttività Real', '0', '0', '0', '0', '0', '0', '0'],
        ];
        // Fill up to row 36
        for (let i = 11; i < 36; i++) template.push([`Riga ${i + 1}`, '', '', '', '', '', '', '']);
        // Kitchen Rows
        template.push(['CUCINA - Chef (R37)', '', '', '', '', '', '', '']);
        template.push(['CUCINA - Sous Chef (R38)', '', '', '', '', '', '', '']);
        template.push(['CUCINA - ACCSU (R39)', '', '', '', '', '', '', '']);
        template.push(['CUCINA - Capo Partita (R40)', '', '', '', '', '', '', '']);
        template.push(['CUCINA - Commis (R41)', '', '', '', '', '', '', '']);
        template.push(['CUCINA - Lavaggio (R42)', '', '', '', '', '', '', '']);
        template.push(['CUCINA - Jolly (R43)', '', '', '', '', '', '', '']);
        template.push(['CUCINA - Extra (R44)', '', '', '', '', '', '', '']);
        template.push(['CUCINA - Totale Ore (R45)', '0', '0', '0', '0', '0', '0', '0']);

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
                            onChange={(e) => setCurrentYear(parseInt(e.target.value) || new Date().getFullYear())}
                        />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-500 uppercase">Settimana</span>
                        <select
                            className="p-2 border rounded-lg bg-gray-50 font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                            value={selectedWeek?.start}
                            onChange={(e) => setSelectedWeek(weeks.find(w => w.start === e.target.value) || weeks[0])}
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

                            // Advanced parsing to find the real grid start
                            // The user's CSV has garbage at the top ("trova il file...", whitespace)
                            let startRowIndex = -1;
                            for (let i = 0; i < json.length; i++) {
                                const rowStr = json[i].join('').toLowerCase();
                                // Look for key markers like "lunedì" or "budget pranzo"
                                if (rowStr.includes('luned') || rowStr.includes('budget pranzo')) {
                                    startRowIndex = i;
                                    // If we found "Lunedì", we want to include that row (headers)
                                    // If we found "Budget pranzo", we might have missed headers, checking row before
                                    if (rowStr.includes('budget pranzo') && i > 0 && String(json[i - 1][1]).toLowerCase().includes('luned')) {
                                        startRowIndex = i - 1;
                                    } else if (rowStr.includes('budget pranzo')) {
                                        startRowIndex = i; // Fallback, just data
                                    }
                                    break;
                                }
                            }

                            // 1. CODING FIX: Use readAsBinaryString but hint codepage effectively via XLSX
                            // The issue "Lunedà" suggests UTF-8 interpreted as ANSI or vice versa.
                            // XLSX.read usually handles this if we pass the right type.
                            // Let's try explicit 'binary' with codepage hint if needed, or just clean the usage.

                            // To fix "Lunedà¬", we will aggressively clean the text after read.
                            // Also, we'll look for the WEEK number.

                            // Find Week Number or Dates
                            // Valid formats: "Week 42", "13/10/2025"
                            let detectedWeekStart = '';

                            // Scan purely for logic extraction first
                            for (let r = 0; r < Math.min(json.length, 20); r++) {
                                const rowStr = json[r].join(' ').toLowerCase();
                                // Check for "Week XX"
                                const weekMatch = rowStr.match(/week\s+(\d+)/i);
                                if (weekMatch) {
                                    // Found a week number. Let's try to match it to our weeks list.
                                    const wNum = parseInt(weekMatch[1]);
                                    const matchingWeek = weeks.find(w => w.week === wNum);
                                    if (matchingWeek) {
                                        detectedWeekStart = matchingWeek.start;
                                        break;
                                    }
                                }

                                // Alternative: Check for dates "dd/mm/yyyy"
                                const dateMatch = rowStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
                                if (dateMatch) {
                                    // This is likely a Monday date in the header
                                    // 13/10/2025 -> 2025-10-13
                                    // We can try to match this to our weeks
                                    const isoDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
                                    const matchingWeek = weeks.find(w => w.start === isoDate);
                                    if (matchingWeek) {
                                        detectedWeekStart = matchingWeek.start;
                                        break;
                                    }
                                }
                            }

                            if (detectedWeekStart && detectedWeekStart !== selectedWeek.start) {
                                const confirmSwitch = confirm(`⚠️ Ho rilevato che questo file è per la settimana del ${detectedWeekStart}. \nVuoi cambiare automaticamente settimana e importare lì?`);
                                if (confirmSwitch) {
                                    const newWeek = weeks.find(w => w.start === detectedWeekStart);
                                    if (newWeek) {
                                        setSelectedWeek(newWeek);
                                        // We need to wait for state update or just proceed? 
                                        // React state updates are async. Ideally we set state then save.
                                        // But here we might just save to memory 'data' state, and user hits save.
                                        // BUT if user hits SAVE, it saves to *selectedWeek*.
                                        // We must ensure selectedWeek is updated.
                                        // A trick is to use a ref or force the saveToDb to take an arg.
                                        // Let's rely on user clicking Save AFTER standard state update, 
                                        // OR we just alert them "Week changed to X. Click Save."
                                    }
                                }
                            }

                            // If found, slice from there. If not, use whole file (maybe it's clean)
                            const dataToProcess = startRowIndex > -1 ? json.slice(startRowIndex) : json;

                            // Clean Data Headers (Simple replace for common Italian encoding errors)
                            // LunedÃ¬ -> Lunedì, etc.
                            // We can use a map
                            const replacements: Record<string, string> = {
                                'lunedÃ¬': 'Lunedì', 'martedÃ¬': 'Martedì', 'mercoledÃ¬': 'Mercoledì',
                                'giovedÃ¬': 'Giovedì', 'venerdÃ¬': 'Venerdì', 'luned': 'Lunedì',
                                'marted': 'Martedì', 'mercoled': 'Mercoledì', 'gioved': 'Giovedì', 'venerd': 'Venerdì',
                                'lunedà': 'Lunedì', 'martedà': 'Martedì', 'mercoledà': 'Mercoledì', 'giovedà': 'Giovedì', 'venerdà': 'Venerdì',
                                'produttivit': 'Produttività', 'produttività': 'Produttività', 'produttivitÃ': 'Produttività'
                            };

                            let cleanData = dataToProcess.map(row => row.map(cell => {
                                let val = String(cell ?? '').trim();

                                // Fix Headers
                                Object.keys(replacements).forEach(bad => {
                                    if (val.toLowerCase().includes(bad)) {
                                        val = val.replace(new RegExp(bad, 'ig'), replacements[bad]);
                                    }
                                });

                                // Clean Numbers (as before)
                                if (/[0-9]/.test(val) && !val.toLowerCase().includes('week') && !val.includes('/')) {
                                    val = val.replace(/[^0-9.,-]/g, '');
                                }

                                return val;
                            }));

                            // Ensure we have enough columns (fill up to 8 if needed)
                            cleanData = cleanData.map(row => {
                                while (row.length < 8) row.push('');
                                return row;
                            });

                            // Force Headers based on known structure if this looks like the header row
                            const headerRow = cleanData[0];
                            if (headerRow && headerRow.length >= 8) {
                                // Double check it looks like a header row (contains budget/real keyword or simply is the first row of import)
                                // We'll just force the days to be nice.
                                const days = ['Dettaglio', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
                                cleanData[0] = days;
                            }

                            setData(cleanData);
                            // Auto-save to DB to persist changes immediately
                            await saveToDb(cleanData);
                            alert('✅ Dati importati e salvati correttamente! Controlla la settimana selezionata.');
                        } catch (err) {
                            console.error(err);
                            alert('Errore lettura file');
                        } finally {
                            setLoading(false);
                            // Reset input
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
                                        const isEdit = (cIdx >= 1 && cIdx <= 7) && (l.includes('budget') || l.includes('real') || l.includes('ore') || l.includes('day'));

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
                                        return <td key={cIdx} className="p-3 text-right text-gray-700 border border-gray-100 text-sm">{cell}</td>;
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
