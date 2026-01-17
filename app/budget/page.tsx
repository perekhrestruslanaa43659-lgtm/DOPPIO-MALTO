
'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import * as XLSX from 'xlsx';
import { Save, Upload, Download, RefreshCw, DollarSign } from 'lucide-react';

// Setup Helpers
import { getWeekNumber, getWeekRange, getDatesInRange } from '@/lib/date-utils';

export default function BudgetPage() {
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [week, setWeek] = useState(getWeekNumber(new Date()));
    const [range, setRange] = useState(getWeekRange(getWeekNumber(new Date()), new Date().getFullYear()));

    // Restore from LocalStorage on mount
    useEffect(() => {
        let y = new Date().getFullYear();
        let w = getWeekNumber();

        if (typeof window !== 'undefined') {
            const savedYear = localStorage.getItem('global_year');
            const savedWeek = localStorage.getItem('global_week_number');

            if (savedYear && savedWeek) {
                y = parseInt(savedYear);
                w = parseInt(savedWeek);
            } else {
                // If missing, SAVE Defaults immediately
                localStorage.setItem('global_year', y.toString());
                localStorage.setItem('global_week_number', w.toString());
            }
        }

        setCurrentYear(y);
        setWeek(w);
        setRange(getWeekRange(w, y));
    }, []);

    const changeWeek = (w: number) => {
        setWeek(w);
        setRange(getWeekRange(w, currentYear));
        localStorage.setItem('global_week_number', w.toString());
        localStorage.setItem('global_year', currentYear.toString());
    };

    const days = getDatesInRange(range.start, range.end);

    useEffect(() => {
        loadData();
    }, [range]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [sch, stf, bdg, fcasts] = await Promise.all([
                api.getSchedule(range.start, range.end),
                api.getStaff(),
                api.getBudget(range.start, range.end),
                api.getForecast(range.start, range.end)
            ]);
            setSchedule(sch as any[]);
            setStaff(stf as any[]);

            const bMap: any = {};
            (bdg as any[]).forEach(b => {
                bMap[b.data.split('T')[0]] = {
                    valueLunch: b.valueLunch || 0,
                    valueDinner: b.valueDinner || 0,
                    hoursLunch: b.hoursLunch || 0,
                    hoursDinner: b.hoursDinner || 0,
                    value: b.value || 0
                };
            });

            // Integrate Forecast Data if available and budget is empty-ish?
            // Or just allow manual sync. Let's process it for potential usage.
            if (fcasts && (fcasts as any[]).length > 0) {
                const f = (fcasts as any[])[0];
                try {
                    const grid = JSON.parse(f.data);
                    // Find rows
                    let idxBP = -1, idxBC = -1, idxHB = -1;
                    grid.forEach((row: any[], i: number) => {
                        const l = String(row[0]).toLowerCase();
                        if (l.includes('budget') && l.includes('pranzo')) idxBP = i;
                        if (l.includes('budget') && l.includes('cena')) idxBC = i;
                        if (l.includes('ore') && l.includes('budget')) idxHB = i;
                    });

                    const days = getDatesInRange(range.start, range.end); // Mon-Sun
                    days.forEach((date, i) => {
                        const col = i + 1; // 1-based index in forecast grid (0 is header)
                        if (col > 7) return;

                        // Get existing or default
                        const exist = bMap[date] || { valueLunch: 0, valueDinner: 0, hoursLunch: 0, hoursDinner: 0, value: 0 };

                        // Parse Forecast Values
                        const parse = (r: number) => {
                            if (r === -1 || !grid[r] || !grid[r][col]) return 0;
                            let s = String(grid[r][col]).replace(/[^0-9.,-]/g, '');
                            if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
                            return parseFloat(s) || 0;
                        };

                        const valL = parse(idxBP);
                        const valD = parse(idxBC);
                        const hoursTot = parse(idxHB);

                        // Only overwrite if existing is 0 (to avoid overwriting manual edits on reload)
                        // OR if we want to force sync, we might need a button.
                        // User said "must be connected", implying auto-flow. 
                        // Let's autofill logic: if explicit budget is missing, use forecast.

                        if (exist.valueLunch === 0) exist.valueLunch = valL;
                        if (exist.valueDinner === 0) exist.valueDinner = valD;
                        exist.value = exist.valueLunch + exist.valueDinner;

                        if (exist.hoursLunch === 0 && exist.hoursDinner === 0 && hoursTot > 0) {
                            // Split hours by revenue
                            if (exist.value > 0) {
                                exist.hoursLunch = parseFloat(((exist.valueLunch / exist.value) * hoursTot).toFixed(2));
                                exist.hoursDinner = parseFloat(((exist.valueDinner / exist.value) * hoursTot).toFixed(2));
                            } else {
                                exist.hoursLunch = parseFloat((hoursTot / 2).toFixed(2));
                                exist.hoursDinner = parseFloat((hoursTot / 2).toFixed(2));
                            }
                        }

                        bMap[date] = exist;
                    });

                } catch (e) { console.error("Forecast parse error", e); }
            }

            setBudgetMap(bMap);
        } catch (e: any) {
            alert("Errore caricamento: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const getStats = (date: string) => {
        let hl = 0, hd = 0;
        schedule.filter(a => a.data.split('T')[0] === date).forEach(a => {
            let start = a.start_time;
            let end = a.end_time;
            if (!start && a.shiftTemplate) {
                start = a.shiftTemplate.oraInizio;
                end = a.shiftTemplate.oraFine;
            }
            if (start && end) {
                const [h1, m1] = start.split(':').map(Number);
                const [h2, m2] = end.split(':').map(Number);
                let startDec = h1 + m1 / 60;
                let endDec = h2 + m2 / 60;
                if (endDec < startDec) endDec += 24;

                const CUTOFF = 16.0;
                if (startDec < CUTOFF) hl += (Math.min(endDec, CUTOFF) - startDec);
                if (endDec > CUTOFF) hd += (endDec - Math.max(startDec, CUTOFF));
            }
        });
        return { hl: parseFloat(hl.toFixed(2)), hd: parseFloat(hd.toFixed(2)) };
    };

    const updateLocalState = (date: string, field: string, val: string) => {
        const old = budgetMap[date] || { valueLunch: 0, valueDinner: 0, hoursLunch: 0, hoursDinner: 0, value: 0 };
        const parsed = parseFloat(val) || 0;
        const newItem = { ...old, [field]: parsed };
        if (field === 'valueLunch' || field === 'valueDinner') {
            newItem.value = (field === 'valueLunch' ? parsed : (newItem.valueLunch || 0)) + (field === 'valueDinner' ? parsed : (newItem.valueDinner || 0));
        }
        setBudgetMap({ ...budgetMap, [date]: newItem });
    };

    const persistRow = async (date: string) => {
        const item = budgetMap[date];
        if (!item) return;
        try {
            await api.upsertBudget({
                data: date,
                valueLunch: item.valueLunch,
                valueDinner: item.valueDinner,
                hoursLunch: item.hoursLunch,
                hoursDinner: item.hoursDinner,
                value: item.value
            });
        } catch (e) {
            console.error("Save failed for " + date, e);
        }
    };

    const saveAll = async () => {
        setLoading(true);
        try {
            const promises = days.map(d => persistRow(d));
            await Promise.all(promises);
            alert("Dati salvati con successo! ✅");
        } catch (e: any) {
            alert("Errore salvataggio: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleForecastImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const wb = XLSX.read(evt.target?.result, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[];

                // Parse logic simplified
                const DATE_ROW_IDX = 5;
                let IDX_HOURS_L = 7, IDX_HOURS_D = 10, IDX_EURO = 14;

                const rowDates = rows[DATE_ROW_IDX];
                if (!rowDates) return alert("Errore file");

                const parseEuro = (val: any) => {
                    const s = String(val).replace(/€/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
                    return parseFloat(s) || 0;
                };

                const parseDate = (val: any) => {
                    if (typeof val === 'number') return new Date(Math.round((val - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
                    const d = String(val).trim();
                    if (d.includes('/')) {
                        const [dd, mm, yy] = d.split('/');
                        return `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
                    }
                    return null;
                };

                const promises = [];
                for (let i = 1; i < rowDates.length; i++) {
                    const ds = parseDate(rowDates[i]);
                    if (ds) {
                        promises.push(api.upsertBudget({
                            data: ds,
                            value: parseEuro(rows[IDX_EURO]?.[i]),
                            hoursLunch: parseEuro(rows[IDX_HOURS_L]?.[i]),
                            hoursDinner: parseEuro(rows[IDX_HOURS_D]?.[i])
                        }));
                    }
                }
                await Promise.all(promises);
                alert("Importazione completata!");
                loadData();
            } catch (ex: any) {
                alert("Errore import: " + ex.message);
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="max-w-Full mx-auto p-6 bg-gray-50 min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-sm gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
                        <DollarSign className="text-emerald-600" />
                        Gestione Budget
                    </h1>
                    <p className="text-gray-500 mt-1">Confronto Costi, Ricavi e Produttività</p>
                </div>
                <div className="flex gap-4 items-center">
                    <div className="flex items-center gap-2">
                        <div className="flex flex-col px-2 bg-gray-50 rounded">
                            <span className="text-[10px] uppercase text-gray-500 font-bold">Anno</span>
                            <input
                                type="number"
                                className="bg-transparent font-bold w-16 text-sm outline-none"
                                value={currentYear}
                                onChange={async (e) => {
                                    const y = parseInt(e.target.value) || 2025;
                                    setCurrentYear(y);
                                    setRange(getWeekRange(week, y));
                                    localStorage.setItem('global_year', y.toString());
                                    localStorage.setItem('global_week_number', week.toString());
                                }}
                            />
                        </div>
                        <span className="font-bold text-gray-700">Settimana:</span>
                        <select className="p-2 border rounded-lg bg-gray-50 font-medium" value={week} onChange={e => changeWeek(Number(e.target.value))}>
                            {Array.from({ length: 53 }, (_, i) => i + 1).map(w => (
                                <option key={w} value={w}>W{w}</option>
                            ))}
                        </select>
                        <span className="text-sm text-gray-500">({range.start} - {range.end})</span>
                    </div>
                    <button onClick={loadData} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition"><RefreshCw className={loading ? 'animate-spin' : ''} /></button>
                </div>
            </div>

            <div className="flex gap-4 mb-6">
                <label className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium shadow-sm cursor-pointer">
                    <Upload size={18} /> Importa Forecast Esterno
                    <input type="file" className="hidden" onChange={handleForecastImport} accept=".csv, .xlsx" />
                </label>
                <button onClick={saveAll} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-sm">
                    <Save size={18} /> Salva Modifiche
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1200px]">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-bold text-xs">
                        <tr>
                            <th className="p-4" rowSpan={2}>Data</th>
                            <th className="p-4 text-center border-l bg-emerald-50 text-emerald-800" colSpan={2}>Budget € (Ricavi)</th>
                            <th className="p-4 text-center border-l bg-blue-50 text-blue-800" colSpan={2}>Budget Ore</th>
                            <th className="p-4 text-center border-l bg-gray-100" colSpan={2}>Ore Reali (Schedulato)</th>
                            <th className="p-4 text-center border-l bg-purple-50 text-purple-800" colSpan={3}>Produttività €/h</th>
                        </tr>
                        <tr>
                            <th className="p-2 text-center border-l bg-emerald-50">Pranzo</th>
                            <th className="p-2 text-center bg-emerald-50">Cena</th>
                            <th className="p-2 text-center border-l bg-blue-50">Pranzo</th>
                            <th className="p-2 text-center bg-blue-50">Cena</th>
                            <th className="p-2 text-center border-l bg-gray-100">Pranzo</th>
                            <th className="p-2 text-center bg-gray-100">Cena</th>
                            <th className="p-2 text-center border-l bg-purple-50">Pranzo</th>
                            <th className="p-2 text-center bg-purple-50">Cena</th>
                            <th className="p-2 text-center bg-purple-100 font-extrabold">TOT</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {days.map(d => {
                            const b = budgetMap[d] || { valueLunch: 0, valueDinner: 0, hoursLunch: 0, hoursDinner: 0 };
                            const s = getStats(d);
                            const prodP = s.hl > 0 ? (b.valueLunch / s.hl).toFixed(2) : '-';
                            const prodS = s.hd > 0 ? (b.valueDinner / s.hd).toFixed(2) : '-';
                            const totVal = (b.valueLunch || 0) + (b.valueDinner || 0);
                            const totHours = s.hl + s.hd;
                            const prodTot = totHours > 0 ? (totVal / totHours).toFixed(2) : '-';

                            return (
                                <tr key={d} className="hover:bg-gray-50 transition">
                                    <td className="p-3 font-medium text-gray-900 border-r">{d}</td>

                                    {/* Budget Value */}
                                    <td className="p-0 border-r relative">
                                        <input type="number"
                                            className="w-full h-full p-2 text-center outline-none focus:bg-emerald-100 text-emerald-700 font-bold bg-transparent"
                                            value={b.valueLunch || ''}
                                            onChange={e => updateLocalState(d, 'valueLunch', e.target.value)}
                                            onBlur={() => persistRow(d)}
                                        />
                                    </td>
                                    <td className="p-0 border-r relative">
                                        <input type="number"
                                            className="w-full h-full p-2 text-center outline-none focus:bg-emerald-100 text-emerald-700 font-bold bg-transparent"
                                            value={b.valueDinner || ''}
                                            onChange={e => updateLocalState(d, 'valueDinner', e.target.value)}
                                            onBlur={() => persistRow(d)}
                                        />
                                    </td>

                                    {/* Budget Hours */}
                                    <td className="p-0 border-r relative">
                                        <input type="number"
                                            className="w-full h-full p-2 text-center outline-none focus:bg-blue-100 text-blue-700 font-medium bg-transparent"
                                            value={b.hoursLunch || ''}
                                            onChange={e => updateLocalState(d, 'hoursLunch', e.target.value)}
                                            onBlur={() => persistRow(d)}
                                        />
                                    </td>
                                    <td className="p-0 border-r relative">
                                        <input type="number"
                                            className="w-full h-full p-2 text-center outline-none focus:bg-blue-100 text-blue-700 font-medium bg-transparent"
                                            value={b.hoursDinner || ''}
                                            onChange={e => updateLocalState(d, 'hoursDinner', e.target.value)}
                                            onBlur={() => persistRow(d)}
                                        />
                                    </td>

                                    {/* Real Hours */}
                                    <td className="p-3 text-center text-gray-600 bg-gray-50 border-r">{s.hl}</td>
                                    <td className="p-3 text-center text-gray-600 bg-gray-50 border-r">{s.hd}</td>

                                    {/* Prod */}
                                    <td className="p-3 text-center font-bold text-purple-700 border-r">{prodP}</td>
                                    <td className="p-3 text-center font-bold text-purple-700 border-r">{prodS}</td>
                                    <td className="p-3 text-center font-black text-purple-900 bg-purple-50">{prodTot}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
