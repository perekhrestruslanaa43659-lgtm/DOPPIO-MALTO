'use client';

import React, { useState, useEffect } from 'react';
import { Send, TrendingUp, DollarSign, Calendar, Save, RefreshCw, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { getWeekNumber, getWeekRange, getDatesInRange } from '@/lib/date-utils';

export default function ClosingsPage() {
    // Week State
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [week, setWeek] = useState(getWeekNumber(new Date()));
    const [range, setRange] = useState(getWeekRange(getWeekNumber(new Date()), new Date().getFullYear()));

    // Data State
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [budgetMap, setBudgetMap] = useState<any>({});
    const [statsMap, setStatsMap] = useState<any>({});

    // Email State
    const [availableRecipients, setAvailableRecipients] = useState<any[]>([]);
    const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
    const [customEmail, setCustomEmail] = useState('');
    const [sending, setSending] = useState(false);

    // Initial Load & Persistence
    useEffect(() => {
        const savedWeek = localStorage.getItem('closings_week');
        const savedYear = localStorage.getItem('closings_year');
        if (savedWeek && savedYear) {
            const w = parseInt(savedWeek);
            const y = parseInt(savedYear);
            if (!isNaN(w) && !isNaN(y)) {
                setWeek(w);
                setCurrentYear(y);
                setRange(getWeekRange(w, y));
            }
        }

        // Load Saved Recipients
        try {
            const savedRecipients = localStorage.getItem('closings_recipients');
            if (savedRecipients) {
                setSelectedRecipients(JSON.parse(savedRecipients));
            }
        } catch (e) {
            console.error("Error loading saved recipients", e);
        }

        // Fetch Users for Email Selection
        fetch('/api/users', { headers: { 'x-user-tenant-key': 'default-tenant' } }) // TODO: Get actual tenant from context/auth
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setAvailableRecipients(data);
                }
            })
            .catch(err => console.error("Error fetching users", err));

    }, []); // Run once on mount

    const days = getDatesInRange(range.start, range.end);
    const dayNames = days.map(d => {
        const date = new Date(d);
        return date.toLocaleDateString('it-IT', { weekday: 'short' });
    });

    useEffect(() => {
        loadData();
    }, [range]);

    const changeWeek = (w: number) => {
        setWeek(w);
        setRange(getWeekRange(w, currentYear));
        localStorage.setItem('closings_week', w.toString());
        localStorage.setItem('closings_year', currentYear.toString());
    };

    const loadData = async () => {
        console.log("Loading Closings Data...");
        setLoading(true);
        try {
            console.log("Fetching API data...");
            const [bdg, sts, fcasts] = await Promise.all([
                api.getBudget(range.start, range.end),
                api.getClosingStats(range.start, range.end),
                api.getForecast(range.start, range.end)
            ]);
            console.log("API Data received:", { bdg: (bdg as any)?.length, sts: (sts as any)?.length, fcasts: (fcasts as any)?.length });

            // Map Budget Data (includes Manual Real Data now)
            const bMap: any = {};
            (bdg as any[]).forEach(b => {
                bMap[b.data.split('T')[0]] = b;
            });

            // --- INTEGRATE FORECAST DATA (Parity with BudgetPage) ---
            if (fcasts && (fcasts as any[]).length > 0) {
                console.log("Processing Forecast Data...");
                const f = (fcasts as any[])[0];
                try {
                    const grid = JSON.parse(f.data);
                    console.log("Forecast Grid parsed, rows:", grid.length);

                    let idxBP = -1, idxBC = -1, idxHB = -1, idxCP = -1, idxCC = -1;
                    grid.forEach((row: any[], i: number) => {
                        const l = String(row[0] || '').toLowerCase();
                        if (l.includes('budget') && l.includes('pranzo')) idxBP = i;
                        if (l.includes('budget') && l.includes('cena')) idxBC = i;
                        if ((l.includes('ore') && l.includes('budget')) || l.includes('ore previste')) idxHB = i;
                        if (l.includes('coperti') && l.includes('pranzo')) idxCP = i;
                        if (l.includes('coperti') && l.includes('cena')) idxCC = i;
                    });
                    console.log("Indices found:", { idxBP, idxBC, idxHB, idxCP, idxCC });

                    const daysInWeek = getDatesInRange(range.start, range.end);
                    daysInWeek.forEach((date, i) => {
                        const col = i + 1; // 1-based index
                        if (col > 7) return;

                        const exist = bMap[date] || {
                            data: date,
                            valueLunch: 0, valueDinner: 0,
                            realValueLunch: 0, realValueDinner: 0,
                            realCoversLunch: 0, realCoversDinner: 0,
                            budgetCoversLunch: 0, budgetCoversDinner: 0,
                            hoursLunchKitchen: 0, hoursDinnerKitchen: 0,
                            hoursLunchHall: 0, hoursDinnerHall: 0
                        };

                        const parse = (r: number) => {
                            if (r === -1 || !grid[r] || !grid[r][col]) return 0;
                            let s = String(grid[r][col]).replace(/[^0-9.,-]/g, '');
                            if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
                            return parseFloat(s) || 0;
                        };

                        const valL = parse(idxBP);
                        const valD = parse(idxBC);
                        const hoursTot = parse(idxHB);
                        const covL = parse(idxCP);
                        const covD = parse(idxCC);

                        // Only override if we have valid data from Forecast
                        if (idxBP !== -1) exist.valueLunch = valL;
                        if (idxBC !== -1) exist.valueDinner = valD;
                        if (idxCP !== -1) exist.budgetCoversLunch = covL;
                        if (idxCC !== -1) exist.budgetCoversDinner = covD;

                        const totalValue = (exist.valueLunch || 0) + (exist.valueDinner || 0);

                        // FORCE OVERWRITE HOURS from Forecast if present
                        if (idxHB !== -1 && hoursTot > 0) {
                            let ratio = 0.5;
                            if (totalValue > 0) {
                                ratio = exist.valueLunch / totalValue;
                            }
                            exist.hoursLunchKitchen = parseFloat((hoursTot * ratio).toFixed(2));
                            exist.hoursDinnerKitchen = parseFloat((hoursTot * (1 - ratio)).toFixed(2));
                            exist.hoursLunchHall = 0;
                            exist.hoursDinnerHall = 0;
                        }
                        bMap[date] = exist;
                    });
                } catch (e) {
                    console.error("Forecast parse error", e);
                }
            }

            setBudgetMap(bMap);

            // Map Stats Data (Calculated Hours)
            setStatsMap(sts);

        } catch (e: any) {
            console.error("LoadData Error:", e);
            alert("Errore caricamento dati: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = (date: string, field: string, val: string) => {
        const v = parseFloat(val.replace(',', '.')) || 0;
        setBudgetMap((prev: any) => ({
            ...prev,
            [date]: {
                ...prev[date],
                [field]: v
            }
        }));
    };

    const saveRow = async (date: string) => {
        const row = budgetMap[date];
        if (!row) return;

        setSaving(true);
        try {
            await api.updateBudget(date, row);
        } catch (e) {
            console.error(e);
            alert('Errore salvataggio');
        } finally {
            setSaving(false);
        }
    };

    // getVal moved outside component

    const handleSendEmail = async () => {
        if (selectedRecipients.length === 0) return;
        setSending(true);
        try {
            const recipientString = selectedRecipients.join(', ');
            // Helpers for Email Data
            const fmt = (n: number, isCurrency = false) => isCurrency
                ? n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
                : n.toLocaleString('it-IT', { maximumFractionDigits: 0 });

            const calcDiffPerc = (real: number, budget: number) => {
                if (!budget) return '-';
                return ((real - budget) / budget * 100).toFixed(1) + '%';
            };

            const buildSection = (title: string, type: 'lunch' | 'dinner' | 'total'): any => { // Returns ClosingSection
                const salesReal: string[] = [];
                const salesBud: string[] = [];
                const salesDiffPerc: string[] = [];

                const coversReal: string[] = [];
                const coversBud: string[] = [];
                const coversDiffPerc: string[] = [];

                const prodReal: string[] = [];
                const prodBud: string[] = [];

                // Daily Values
                days.forEach(d => {
                    const sv = getVal(d, 'sales_real', type, budgetMap, statsMap);
                    const sb = getVal(d, 'sales_bud', type, budgetMap, statsMap);

                    const cr = getVal(d, 'covers_real', type, budgetMap, statsMap);
                    const cb = getVal(d, 'covers_bud', type, budgetMap, statsMap);

                    const hr = getVal(d, 'hours_sala_real', type, budgetMap, statsMap) + getVal(d, 'hours_cuc_real', type, budgetMap, statsMap);
                    const hb = getVal(d, 'hours_sala_bud', type, budgetMap, statsMap) + getVal(d, 'hours_cuc_bud', type, budgetMap, statsMap);

                    salesReal.push(fmt(sv, true));
                    salesBud.push(fmt(sb, true));
                    salesDiffPerc.push(calcDiffPerc(sv, sb));

                    coversReal.push(fmt(cr));
                    coversBud.push(fmt(cb));
                    coversDiffPerc.push(calcDiffPerc(cr, cb));

                    prodReal.push(hr ? fmt(sv / hr, true) : '-');
                    prodBud.push(hb ? fmt(sb / hb, true) : '-');
                });

                // Totals
                const sum = (metric: string) => days.reduce((acc, d) => acc + getVal(d, metric, type, budgetMap, statsMap), 0);

                const totSR = sum('sales_real');
                const totSB = sum('sales_bud');
                const totCR = sum('covers_real');
                const totCB = sum('covers_bud');
                const totHR = sum('hours_sala_real') + sum('hours_cuc_real');
                const totHB = sum('hours_sala_bud') + sum('hours_cuc_bud');

                salesReal.push(fmt(totSR, true));
                salesBud.push(fmt(totSB, true));
                salesDiffPerc.push(calcDiffPerc(totSR, totSB));

                coversReal.push(fmt(totCR));
                coversBud.push(fmt(totCB));
                coversDiffPerc.push(calcDiffPerc(totCR, totCB));

                prodReal.push(totHR ? fmt(totSR / totHR, true) : '-');
                prodBud.push(totHB ? fmt(totSB / totHB, true) : '-');

                return {
                    title,
                    sales: { real: salesReal, budget: salesBud, diffPerc: salesDiffPerc, diffVal: [] },
                    covers: { real: coversReal, budget: coversBud, diffPerc: coversDiffPerc, diffVal: [] },
                    ticket: { real: [], budget: [], diffPerc: [], diffVal: [] },
                    hours: { salaReal: [], cucinaReal: [], salaBudget: [], cucinaBudget: [] },
                    productivity: { real: prodReal, budget: prodBud, diffPerc: [], diffVal: [] }
                };
            };

            const emailData = {
                week: `Week ${week}`,
                dates: [...days],
                lunch: buildSection('PRANZO', 'lunch'),
                dinner: buildSection('CENA', 'dinner'),
                total: buildSection('TOTALE', 'total')
            };

            const res = await fetch('/api/email/summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipient: recipientString, data: emailData })
            });

            if (!res.ok) throw new Error('Errore invio');
            alert("Report inviato con successo!");

        } catch (error) {
            console.error(error);
            alert("Errore durante l'invio");
        } finally {
            setSending(false);
        }
    };

    // UI Components
    const SectionTable = ({ title, type }: { title: string, type: 'lunch' | 'dinner' | 'total' }) => {
        // Helper to get total for current view
        const getTotal = (metric: string) => {
            return days.reduce((acc, d) => acc + getVal(d, metric, type, budgetMap, statsMap), 0);
        };

        // Render Cell Input or Value
        const Cell = ({ dIdx, metric, isInput = false, isCurrency = false }: any) => {
            const val = dIdx === 7 ? getTotal(metric) : getVal(days[dIdx], metric, type, budgetMap, statsMap);

            if (isInput && dIdx < 7) {
                const d = days[dIdx];
                const field = metric === 'sales_real' ? (type === 'lunch' ? 'realValueLunch' : 'realValueDinner')
                    : metric === 'covers_real' ? (type === 'lunch' ? 'realCoversLunch' : 'realCoversDinner')
                        : '';
                if (!field) return <span>-</span>;

                return (
                    <input
                        type="number"
                        className="w-full h-full bg-transparent text-right outline-none focus:bg-blue-50 font-bold text-slate-700"
                        value={val || ''}
                        onChange={e => handleUpdate(d, field, e.target.value)}
                        onBlur={() => saveRow(d)}
                    />
                );
            }

            // Format
            if (val === 0 || !val) return <span className="text-slate-300">-</span>;
            return isCurrency
                ? val.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
                : val.toLocaleString('it-IT', { maximumFractionDigits: 1 });
        };

        // Calculated Rows Helpers
        const DiffCell = ({ dIdx, mReal, mBud, type: diffType = 'val' }: any) => {
            const r = dIdx === 7 ? getTotal(mReal) : getVal(days[dIdx], mReal, type, budgetMap, statsMap);
            const b = dIdx === 7 ? getTotal(mBud) : getVal(days[dIdx], mBud, type, budgetMap, statsMap);

            if (!b) return <span className="text-slate-300">-</span>;
            const diff = r - b;
            const perc = (diff / b) * 100;

            const color = diff >= 0 ? 'text-emerald-600' : 'text-red-500';

            if (diffType === 'perc') return <span className={`${color} font-medium`}>{perc > 0 ? '+' : ''}{perc.toFixed(1)}%</span>;
            return <span className={color}>{diff > 0 ? '+' : ''}{diff.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</span>;
        };

        const ProdCell = ({ dIdx, mSales, mHours }: any) => {
            const s = dIdx === 7 ? getTotal(mSales) : getVal(days[dIdx], mSales, type, budgetMap, statsMap);

            // Determine Real vs Budget Hours
            let h = 0;
            if (mHours === 'real') {
                h = dIdx === 7
                    ? getTotal('hours_sala_real') + getTotal('hours_cuc_real')
                    : getVal(days[dIdx], 'hours_sala_real', type, budgetMap, statsMap) + getVal(days[dIdx], 'hours_cuc_real', type, budgetMap, statsMap);
            } else {
                h = dIdx === 7
                    ? getTotal('hours_sala_bud') + getTotal('hours_cuc_bud')
                    : getVal(days[dIdx], 'hours_sala_bud', type, budgetMap, statsMap) + getVal(days[dIdx], 'hours_cuc_bud', type, budgetMap, statsMap);
            }

            if (!h) return <span className="text-slate-300">-</span>;
            return <span className="font-bold text-slate-700">{(s / h).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>;
        };

        const TicketCell = ({ dIdx, mSales, mCovers }: any) => {
            const s = dIdx === 7 ? getTotal(mSales) : getVal(days[dIdx], mSales, type, budgetMap, statsMap);
            const c = dIdx === 7 ? getTotal(mCovers) : getVal(days[dIdx], mCovers, type, budgetMap, statsMap);

            if (!c) return <span className="text-slate-300">-</span>;
            return <span>{(s / c).toLocaleString('it-IT', { maximumFractionDigits: 1 })} €</span>;
        };


        const cols = [...Array(7)].map((_, i) => dayNames[i]);

        return (
            <div className="mb-8 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className={`p-3 border-b border-slate-200 font-bold text-lg flex items-center gap-2 ${type === 'lunch' ? 'bg-emerald-50 text-emerald-800' : type === 'dinner' ? 'bg-indigo-50 text-indigo-800' : 'bg-slate-100 text-slate-800'}`}>
                    {type === 'lunch' && '☀️'} {type === 'dinner' && '🌙'} {type === 'total' && 'Σ'}
                    {title}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs border-collapse min-w-[1000px]">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-bold sticky top-0 z-10">
                            <tr>
                                <th className="p-3 text-left w-48 border-r border-slate-200 bg-slate-50">Giorni</th>
                                {cols.map((d, i) => (
                                    <th key={i} className="p-2 border-r border-slate-200 min-w-[80px] bg-slate-50">
                                        <div className="flex flex-col">
                                            <span>{d}</span>
                                            <span className="text-[10px] text-slate-400 font-normal">{days[i].split('-')[2]}</span>
                                        </div>
                                    </th>
                                ))}
                                <th className="p-2 bg-slate-100 min-w-[90px]">TOT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {/* SALES SECTION */}
                            <tr className="bg-slate-50/50"><td className="p-2 text-left font-bold text-slate-700 border-r">VENDITE REALI</td>
                                {[...Array(8)].map((_, i) => <td key={i} className={`p-2 border-r ${i < 7 ? 'bg-yellow-50/50 input-cell' : ''}`}><Cell dIdx={i} metric="sales_real" isInput={type !== 'total'} isCurrency /></td>)}
                            </tr>
                            <tr><td className="p-2 text-left text-slate-500 border-r pl-4">Budget</td>
                                {[...Array(8)].map((_, i) => <td key={i} className="p-2 border-r text-slate-400"><Cell dIdx={i} metric="sales_bud" isCurrency /></td>)}
                            </tr>
                            <tr><td className="p-2 text-left text-slate-500 border-r pl-4">Scostamento €</td>
                                {[...Array(8)].map((_, i) => <td key={i} className="p-2 border-r"><DiffCell dIdx={i} mReal="sales_real" mBud="sales_bud" /></td>)}
                            </tr>
                            <tr><td className="p-2 text-left text-slate-500 border-r pl-4">Scostamento %</td>
                                {[...Array(8)].map((_, i) => <td key={i} className="p-2 border-r"><DiffCell dIdx={i} mReal="sales_real" mBud="sales_bud" type="perc" /></td>)}
                            </tr>

                            {/* COVERS SECTION */}
                            <tr className="bg-slate-50/50 border-t-2 border-slate-100"><td className="p-2 text-left font-bold text-slate-700 border-r">COPERTI REALI</td>
                                {[...Array(8)].map((_, i) => <td key={i} className={`p-2 border-r ${i < 7 ? 'bg-yellow-50/50 input-cell' : ''}`}><Cell dIdx={i} metric="covers_real" isInput={type !== 'total'} /></td>)}
                            </tr>
                            <tr><td className="p-2 text-left text-slate-500 border-r pl-4">Budget</td>
                                {[...Array(8)].map((_, i) => <td key={i} className="p-2 border-r text-slate-400"><Cell dIdx={i} metric="covers_bud" /></td>)}
                            </tr>
                            <tr><td className="p-2 text-left text-slate-500 border-r pl-4">Diff %</td>
                                {[...Array(8)].map((_, i) => <td key={i} className="p-2 border-r"><DiffCell dIdx={i} mReal="covers_real" mBud="covers_bud" type="perc" /></td>)}
                            </tr>

                            {/* TICKET MEDIO */}
                            <tr className="bg-slate-50/50 border-t-2 border-slate-100"><td className="p-2 text-left font-bold text-slate-700 border-r">SCONTRINO MEDIO REALE</td>
                                {[...Array(8)].map((_, i) => <td key={i} className="p-2 border-r font-medium"><TicketCell dIdx={i} mSales="sales_real" mCovers="covers_real" /></td>)}
                            </tr>
                            <tr><td className="p-2 text-left text-slate-500 border-r pl-4">Budget</td>
                                {[...Array(8)].map((_, i) => <td key={i} className="p-2 border-r text-slate-400"><TicketCell dIdx={i} mSales="sales_bud" mCovers="covers_bud" /></td>)}
                            </tr>

                            {/* HOURS SECTION */}
                            <tr className="bg-slate-50/50 border-t-2 border-slate-100"><td className="p-2 text-left font-bold text-slate-700 border-r">ORE REALI (Calendario)</td>
                                {[...Array(8)].map((_, i) => {
                                    const h = i === 7
                                        ? getTotal('hours_sala_real') + getTotal('hours_cuc_real')
                                        : getVal(days[i], 'hours_sala_real', type, budgetMap, statsMap) + getVal(days[i], 'hours_cuc_real', type, budgetMap, statsMap);
                                    return <td key={i} className="p-2 border-r font-medium">{h.toFixed(1)}</td>
                                })}
                            </tr>
                            <tr><td className="p-2 text-left text-slate-500 border-r pl-4">Sala (Real)</td>
                                {[...Array(8)].map((_, i) => <td key={i} className="p-2 border-r text-slate-400"><Cell dIdx={i} metric="hours_sala_real" /></td>)}
                            </tr>
                            <tr><td className="p-2 text-left text-slate-500 border-r pl-4">Cucina (Real)</td>
                                {[...Array(8)].map((_, i) => <td key={i} className="p-2 border-r text-slate-400"><Cell dIdx={i} metric="hours_cuc_real" /></td>)}
                            </tr>

                            {/* BUDGET HOURS BREAKDOWN */}
                            <tr className="bg-slate-50/50 border-t border-slate-100"><td className="p-2 text-left font-bold text-emerald-700 border-r">ORE BUDGET (Forecast)</td>
                                {[...Array(8)].map((_, i) => {
                                    const h = i === 7
                                        ? getTotal('hours_sala_bud') + getTotal('hours_cuc_bud')
                                        : getVal(days[i], 'hours_sala_bud', type, budgetMap, statsMap) + getVal(days[i], 'hours_cuc_bud', type, budgetMap, statsMap);
                                    return <td key={i} className="p-2 border-r font-medium text-emerald-600">{h.toFixed(1)}</td>
                                })}
                            </tr>
                            <tr><td className="p-2 text-left text-emerald-500 border-r pl-4">Sala (Budget)</td>
                                {[...Array(8)].map((_, i) => <td key={i} className="p-2 border-r text-emerald-400"><Cell dIdx={i} metric="hours_sala_bud" /></td>)}
                            </tr>
                            <tr><td className="p-2 text-left text-emerald-500 border-r pl-4">Cucina (Budget)</td>
                                {[...Array(8)].map((_, i) => <td key={i} className="p-2 border-r text-emerald-400"><Cell dIdx={i} metric="hours_cuc_bud" /></td>)}
                            </tr>

                            {/* RESIDUE */}
                            <tr className="border-t border-slate-100"><td className="p-2 text-left font-bold text-teal-700 border-r">ORE RESIDUE</td>
                                {[...Array(8)].map((_, i) => {
                                    const real = i === 7
                                        ? getTotal('hours_sala_real') + getTotal('hours_cuc_real')
                                        : getVal(days[i], 'hours_sala_real', type, budgetMap, statsMap) + getVal(days[i], 'hours_cuc_real', type, budgetMap, statsMap);
                                    const bud = i === 7
                                        ? getTotal('hours_sala_bud') + getTotal('hours_cuc_bud')
                                        : getVal(days[i], 'hours_sala_bud', type, budgetMap, statsMap) + getVal(days[i], 'hours_cuc_bud', type, budgetMap, statsMap);

                                    const diff = bud - real;
                                    const color = diff < 0 ? 'text-red-600' : 'text-teal-600';

                                    return <td key={i} className={`p-2 border-r font-bold ${color}`}>{diff.toLocaleString('it-IT', { maximumFractionDigits: 1 })}</td>
                                })}
                            </tr>

                            {/* PRODUCTIVITY SECTION */}
                            <tr className="bg-purple-50/30 border-t-2 border-slate-100"><td className="p-2 text-left font-bold text-purple-700 border-r">PRODUTTIVITÀ REALE</td>
                                {[...Array(8)].map((_, i) => <td key={i} className="p-2 border-r"><ProdCell dIdx={i} mSales="sales_real" mHours="real" /></td>)}
                            </tr>
                            <tr><td className="p-2 text-left text-slate-500 border-r pl-4">Budget</td>
                                {[...Array(8)].map((_, i) => <td key={i} className="p-2 border-r text-slate-400"><ProdCell dIdx={i} mSales="sales_bud" mHours="bud" /></td>)}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 font-sans">
            <div className="max-w-[1600px] mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <TrendingUp className="text-blue-600" />
                            Chiusure Giornaliere
                        </h1>
                        <p className="text-slate-500 text-sm">Inserisci i dati reali giornalieri. Le celle gialle sono modificabili.</p>
                    </div>

                    <div className="flex items-center gap-4 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                        <button onClick={() => changeWeek(week - 1)} className="p-1 hover:bg-slate-100 rounded text-slate-400">◄</button>
                        <div className="text-center">
                            <div className="text-xs font-bold text-slate-400 uppercase">Settimana {week}</div>
                            <div className="text-sm font-medium text-slate-700">{range.start} - {range.end}</div>
                        </div>
                        <button onClick={() => changeWeek(week + 1)} className="p-1 hover:bg-slate-100 rounded text-slate-400">►</button>
                        <button onClick={loadData} className="ml-2 p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <SectionTable title="PRANZO" type="lunch" />
                    <SectionTable title="CENA" type="dinner" />
                    <SectionTable title="TOTALE" type="total" />

                    {/* Email Action */}
                    {/* Email Action */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mt-8">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Send size={20} className="text-indigo-600" />
                            Invia Report
                        </h3>

                        <div className="flex flex-col gap-4">
                            {/* Recipient Selector */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Seleziona Destinatari:</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200 max-h-48 overflow-y-auto">
                                    {availableRecipients.map(u => (
                                        <label key={u.email} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-2 rounded transition">
                                            <input
                                                type="checkbox"
                                                checked={selectedRecipients.includes(u.email)}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setSelectedRecipients(prev => {
                                                        const next = checked
                                                            ? [...prev, u.email]
                                                            : prev.filter(email => email !== u.email);
                                                        localStorage.setItem('closings_recipients', JSON.stringify(next));
                                                        return next;
                                                    });
                                                }}
                                                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                            />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-slate-700">{u.name || u.email.split('@')[0]}</span>
                                                <span className="text-xs text-slate-400">{u.email}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Extra Email Input */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Aggiungi altra email (opzionale):</label>
                                <div className="flex gap-2">
                                    <input
                                        type="email"
                                        placeholder="email@esempio.com"
                                        className="flex-1 border border-slate-300 rounded p-2 text-sm"
                                        value={customEmail}
                                        onChange={(e) => setCustomEmail(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (customEmail && customEmail.includes('@')) {
                                                    setSelectedRecipients(prev => [...prev, customEmail]);
                                                    setCustomEmail('');
                                                }
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={() => {
                                            if (customEmail && customEmail.includes('@')) {
                                                setSelectedRecipients(prev => {
                                                    const next = [...prev, customEmail];
                                                    localStorage.setItem('closings_recipients', JSON.stringify(next));
                                                    return next;
                                                });
                                                setCustomEmail('');
                                            }
                                        }}
                                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded text-sm font-medium"
                                    >
                                        Aggiungi
                                    </button>
                                </div>
                            </div>

                            {/* Summary & Send Button */}
                            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                                <span className="text-sm text-slate-500">
                                    Destinatari selezionati: <strong className="text-slate-800">{selectedRecipients.length}</strong>
                                </span>
                                <button
                                    onClick={handleSendEmail}
                                    disabled={sending || selectedRecipients.length === 0}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm shadow-sm"
                                >
                                    {sending ? 'Invio in corso...' : 'Invia Report'}
                                    <Send size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {saving && <div className="fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded shadow-lg flex items-center gap-2 animate-pulse z-50">
                    <Save size={16} /> Salvataggio...
                </div>}
            </div>
        </div>
    );
}

const getVal = (date: string, metric: string, type: 'lunch' | 'dinner' | 'total', bMap: any, sMap: any) => {
    const dData = bMap[date] || {};
    const sData = sMap?.[date] || { lunch: { sala: 0, cucina: 0 }, dinner: { sala: 0, cucina: 0 } };

    const get = (lRequest: () => number, dRequest: () => number) => {
        if (type === 'lunch') return lRequest();
        if (type === 'dinner') return dRequest();
        return lRequest() + dRequest();
    };

    switch (metric) {
        case 'sales_real': return get(() => dData.realValueLunch || 0, () => dData.realValueDinner || 0);
        case 'sales_bud': return get(() => dData.valueLunch || 0, () => dData.valueDinner || 0);
        case 'covers_real': return get(() => dData.realCoversLunch || 0, () => dData.realCoversDinner || 0);
        case 'covers_bud': return get(() => dData.budgetCoversLunch || 0, () => dData.budgetCoversDinner || 0);

        case 'hours_sala_real': return get(() => sData.lunch?.sala || 0, () => sData.dinner?.sala || 0);
        case 'hours_cuc_real': return get(() => sData.lunch?.cucina || 0, () => sData.dinner?.cucina || 0);

        case 'hours_sala_bud': return get(() => dData.hoursLunchHall || 0, () => dData.hoursDinnerHall || 0);
        case 'hours_cuc_bud': return get(() => dData.hoursLunchKitchen || 0, () => dData.hoursDinnerKitchen || 0);

        default: return 0;
    }
};
