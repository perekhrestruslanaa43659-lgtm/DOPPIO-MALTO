
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Download, Eye, EyeOff, Save } from 'lucide-react';
import { api } from '@/lib/api';
// api not used here anymore if we remove the POST call
import Link from 'next/link';
import * as XLSX from 'xlsx';

const INTERVALS: string[] = [];
let h = 6, m = 0;
for (let i = 0; i < 96; i++) {
    const hh = h.toString().padStart(2, '0');
    const mm = m.toString().padStart(2, '0');
    INTERVALS.push(`${hh}:${mm}`);
    m += 15;
    if (m === 60) { m = 0; h = (h + 1) % 24; }
}

function getWeekRange(w: number, year: number) {
    const d = new Date(Date.UTC(year, 0, 4));
    const day = d.getUTCDay() || 7;
    const sOfYear = new Date(d);
    sOfYear.setUTCDate(d.getUTCDate() - day + 1);
    const startD = new Date(sOfYear);
    startD.setUTCDate(sOfYear.getUTCDate() + (w - 1) * 7);
    return { start: startD.toISOString().slice(0, 10) };
}

function getDatesInRange(startDate: string) {
    const dates = [];
    let curr = new Date(startDate);
    for (let i = 0; i < 7; i++) {
        dates.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
    }
    return dates;
}

function isTimeInRange(time: string, start: string, end: string) {
    if (!start || !end) return false;
    const toMinds = (t: string) => {
        const [hh, mm] = t.split(':').map(Number);
        return hh * 60 + mm;
    }
    let tVal = toMinds(time);
    let sVal = toMinds(start);
    let eVal = toMinds(end);

    if (tVal < 6 * 60) tVal += 1440;
    if (sVal < 6 * 60) sVal += 1440;
    if (eVal < 6 * 60) eVal += 1440;
    if (eVal < sVal) eVal += 1440;

    return tVal >= sVal && tVal < eVal;
}

function CoverageDetailsContent() {
    const searchParams = useSearchParams();

    // Config State
    const [currentYear, setCurrentYear] = useState(2025);
    const [week, setWeek] = useState(42);
    const [isInitialized, setIsInitialized] = useState(false); // Guard for persistence
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState<any[]>([]);
    const [fixedShifts, setFixedShifts] = useState<any[]>([]);
    const [selectedDayIdx, setSelectedDayIdx] = useState(0);
    const [showSimulation, setShowSimulation] = useState(true); // Default ON

    useEffect(() => {
        const pYear = searchParams.get('year');
        const pWeek = searchParams.get('week');
        const savedWeek = localStorage.getItem('calendar_week');
        const savedYear = localStorage.getItem('calendar_year');

        if (pYear) setCurrentYear(parseInt(pYear));
        else if (savedYear) setCurrentYear(parseInt(savedYear));

        if (pWeek) setWeek(parseInt(pWeek));
        else if (savedWeek) setWeek(parseInt(savedWeek));

        setIsInitialized(true);
    }, [searchParams]);

    // Save persistence
    useEffect(() => {
        if (!isInitialized) return;
        localStorage.setItem('calendar_week', week.toString());
        localStorage.setItem('calendar_year', currentYear.toString());
    }, [week, currentYear, isInitialized]);

    const { start: weekStart } = getWeekRange(week, currentYear);
    const days = getDatesInRange(weekStart);
    const currentDayDate = days[selectedDayIdx]; // e.g. "2025-10-13"

    // Load Data
    // Load Data
    const loadData = () => {
        if (!weekStart) return;
        setLoading(true);

        const p1 = fetch(`/api/requirements?date=${weekStart}`).then(r => r.json());
        const p2 = fetch(`/api/recurring-shifts`).then(r => r.json());

        Promise.all([p1, p2])
            .then(([reqData, shiftData]) => {
                if (Array.isArray(reqData)) {
                    setRows(reqData.map((r: any) => ({
                        station: r.station,
                        slots: typeof r.slots === 'string' ? JSON.parse(r.slots) : r.slots,
                        extra: typeof r.extra === 'string' ? JSON.parse(r.extra) : r.extra,
                    })));
                } else setRows([]);

                if (Array.isArray(shiftData)) {
                    setFixedShifts(shiftData);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadData();
    }, [weekStart]);

    // Derived Date details
    // selectedDayIdx: 0=Mon, 1=Tue ... 6=Sun
    // JS Date.getDay(): 0=Sun, 1=Mon ...
    // Map selectedDayIdx to JS getDay format for filtering?
    // User Fixed Shifts uses: 1=Mon ... 6=Sat, 0=Sun. 
    // My selectedDayIdx 0 is Mon (1), 6 is Sun (0).
    // Derived Date details
    // selectedDayIdx: 0=Mon, 1=Tue ... 6=Sun
    // DB uses 1=Mon ... 7=Sun
    const currentDayOfWeek = selectedDayIdx + 1; // 1..7 (Mon..Sun)

    // Normalize helper
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Filter shifts for this day and map by station
    // Map<NormalizedStationName, Array<Intervals>>
    // Map<NormalizedStationName, Array<{ staff: string, times: string[] }>>
    const shiftsByStation: Record<string, { staff: string, times: string[] }[]> = {};

    fixedShifts.forEach(shift => {
        if (!showSimulation) return; // Skip if toggled off
        if (shift.dayOfWeek !== currentDayOfWeek) return;
        if (!shift.postazione) return;

        // Check Week Bounds
        if (shift.startWeek && week < shift.startWeek) return;
        if (shift.endWeek && week > shift.endWeek) return;
        if (shift.startYear && currentYear < shift.startYear) return;
        if (shift.endYear && currentYear > shift.endYear) return;

        const normStation = normalize(shift.postazione);
        if (!shiftsByStation[normStation]) shiftsByStation[normStation] = [];

        // Mark intervals covered by this shift
        const times: string[] = [];
        INTERVALS.forEach(time => {
            if (isTimeInRange(time, shift.start_time, shift.end_time)) {
                times.push(time);
            }
        });

        if (times.length > 0) {
            const staffName = shift.staff ? `${shift.staff.nome} ${shift.staff.cognome}` : 'N/A';
            shiftsByStation[normStation].push({ staff: staffName, times });
        }
    });

    // Build Grid
    const gridRows = rows.map(r => {
        // Skip inactive
        if (r.extra?.active === false) return null;

        const s = r.slots[currentDayDate] || { lIn: '', lOut: '', dIn: '', dOut: '' };

        // Get covered times for this station
        const normReqStation = normalize(r.station);

        // Metadata for cells
        const cellData = INTERVALS.map(time => {
            let covered = false;
            let coveringStaff: string[] = [];

            // Check matches
            Object.keys(shiftsByStation).forEach(shiftKey => {
                if (normReqStation === shiftKey) {
                    shiftsByStation[shiftKey].forEach(entry => {
                        if (entry.times.includes(time)) {
                            covered = true;
                            if (!coveringStaff.includes(entry.staff)) coveringStaff.push(entry.staff);
                        }
                    });
                }
            });

            // Is Required?
            let required = false;
            if ((s.lIn && isTimeInRange(time, s.lIn, s.lOut)) || (s.dIn && isTimeInRange(time, s.dIn, s.dOut))) {
                required = true;
            }

            let status = 0;
            if (required && covered) status = 3;
            else if (required && !covered) status = 1;
            else if (!required && covered) status = 2;

            return { status, staff: coveringStaff.join(', ') };
        });

        const totalReq = cellData.filter(c => c.status === 1 || c.status === 3).length * 0.25;
        const totalCov = cellData.filter(c => c.status === 2 || c.status === 3).length * 0.25;

        return { station: r.station, meta: s, cells: cellData, totalReq, totalCov };
    }).filter(r => r !== null) as any[];

    // Column Totals (Required)
    const colTotalsReq = INTERVALS.map((_, i) => gridRows.reduce((sum, r) => sum + (r.cells[i] === 1 || r.cells[i] === 3 ? 0.25 : 0), 0));

    const exportCsv = () => {
        const header1 = ["Postazione", "Turno 1 Start", "Turno 1 End", "Turno 2 Start", "Turno 2 End", ...INTERVALS, "TOTALE REQ", "TOT COV"];
        const data = gridRows.map(r => [
            r.station,
            r.meta.lIn, r.meta.lOut, r.meta.dIn, r.meta.dOut,
            ...r.cells.map((c: number) => {
                if (c === 3) return "OK";
                if (c === 1) return "REQ";
                if (c === 2) return "COV";
                return "";
            }),
            r.totalReq.toFixed(2).replace('.', ','),
            r.totalCov.toFixed(2).replace('.', ',')
        ]);
        const ws = XLSX.utils.aoa_to_sheet([header1, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Dettaglio");
        XLSX.writeFile(wb, `Dettaglio_${currentDayDate}.xlsx`);
    };

    const handleToggleSimulation = () => {
        setShowSimulation(!showSimulation);
    };

    const handleApplySync = async () => {
        if (!confirm(`Vuoi applicare (copiare) i turni fissi per la settimana ${week}/${currentYear}? I turni esistenti verranno aggiornati, i nuovi creati.`)) return;

        try {
            setLoading(true);
            const res = await api.applyFixedShifts(currentYear, week);
            alert(`Operazione completata! Processati: ${res.processed} turni.`);
            loadData(); // Reload to see real shifts
        } catch (e: any) {
            alert('Errore sync: ' + e.message);
            setLoading(false);
        }
    };

    const dayNames = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <div className="bg-white shadow p-4 flex flex-col gap-4 sticky top-0 z-20 print:hidden">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href={`/requirements?year=${currentYear}&week=${week}`} className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600">
                            <ArrowLeft size={20} />
                        </Link>
                        <h1 className="text-xl font-bold text-gray-800">Dettaglio Fabbisogno & Copertura</h1>
                    </div>
                    <button
                        onClick={handleToggleSimulation}
                        className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-bold shadow-sm transition ${showSimulation ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}
                    >
                        {showSimulation ? <Eye size={16} /> : <EyeOff size={16} />}
                        {showSimulation ? 'Simulazione Attiva' : 'Mostra Simulazione'}
                    </button>
                    <button
                        onClick={handleApplySync}
                        className="flex items-center gap-2 px-4 py-2 rounded text-sm font-bold shadow-sm transition bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200"
                        title="Copia i turni fissi nel calendario reale"
                    >
                        <Save size={16} /> Applica Turni
                    </button>
                    <button onClick={exportCsv} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm font-bold">
                        <Download size={16} /> Export
                    </button>
                </div>

                <div className="flex flex-wrap gap-4 items-center bg-gray-50 p-2 rounded-lg">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-gray-500">ANNO / SETTIMANA</span>
                        <div className="flex gap-2">
                            <input type="number" value={currentYear} onChange={e => setCurrentYear(Number(e.target.value))} className="w-16 font-bold bg-transparent border-b border-gray-300" />
                            <select value={week} onChange={e => setWeek(Number(e.target.value))} className="bg-transparent font-bold border-b border-gray-300">
                                {Array.from({ length: 53 }, (_, i) => i + 1).map(w => <option key={w} value={w}>W{w}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="h-8 w-px bg-gray-300 mx-2"></div>
                    <div className="flex gap-1 overflow-x-auto">
                        {dayNames.map((n, i) => (
                            <button
                                key={n}
                                onClick={() => setSelectedDayIdx(i)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition whitespace-nowrap ${selectedDayIdx === i ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                            >
                                {n} <span className="text-[10px] font-normal opacity-70 ml-1">{days[i]?.split('-').slice(1).join('/')}</span>
                            </button>
                        ))}
                    </div>

                    <div className="ml-auto flex gap-3 text-xs font-bold items-center">
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-200"></div> Richiesto (0.25)</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-300"></div> Coperto (Fixed)</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-400"></div> Extra (Coperto non Richiesto)</div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
                {loading && <div className="text-center p-10 font-bold text-gray-500">Caricamento...</div>}

                <div className="bg-white rounded shadow border border-gray-200 inline-block min-w-full">
                    <table className="border-collapse text-xs table-fixed">
                        <thead>
                            <tr className="bg-gray-100 text-gray-500">
                                <th className="p-2 border bg-white sticky left-0 z-10 w-[150px] text-left">Postazione</th>
                                {INTERVALS.map(t => (
                                    <th key={t} className="p-1 border min-w-[30px] text-[9px] rotate-90 h-20 align-bottom w-[25px]">{t}</th>
                                ))}
                                <th className="p-2 border font-bold bg-yellow-50 w-[50px]">REQ</th>
                                <th className="p-2 border font-bold bg-green-50 w-[50px]">COV</th>
                            </tr>
                        </thead>
                        <tbody>
                            {gridRows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                    <td className="p-1 border font-bold bg-white sticky left-0 z-10 truncate text-[11px] h-8">{row.station}</td>

                                    {row.cells.map((cell: any, cIdx: number) => {
                                        let bg = '';
                                        let text = '';
                                        const val = cell.status;
                                        if (val === 3) { bg = 'bg-green-300'; text = 'OK'; } // Req + Cov
                                        else if (val === 1) { bg = 'bg-red-200 text-red-800'; text = 'REQ'; } // Req only
                                        else if (val === 2) { bg = 'bg-blue-400 text-white'; text = '+'; } // Cov only (Extra) - BLUE

                                        return (
                                            <td
                                                key={cIdx}
                                                className={`border text-center text-[7px] p-0 ${bg}`}
                                                title={cell.staff || ''} // Tooltip with staff names
                                            >
                                                {text}
                                            </td>
                                        );
                                    })}
                                    <td className="p-1 border font-bold bg-yellow-50 text-center">{row.totalReq.toFixed(2)}</td>
                                    <td className="p-1 border font-bold bg-green-50 text-center">{row.totalCov.toFixed(2)}</td>
                                </tr>
                            ))}
                            <tr className="bg-gray-100 font-bold">
                                <td className="p-2 border text-right sticky left-0 bg-gray-100 z-10">TOT REQ</td>
                                {colTotalsReq.map((tot, i) => (
                                    <td key={i} className={`border text-center text-[7px] ${tot > 0 ? 'bg-indigo-100 text-indigo-800' : ''}`}>
                                        {tot > 0 ? tot.toFixed(2).replace('.', ',') : ''}
                                    </td>
                                ))}
                                <td className="p-2 border bg-yellow-100 text-center">
                                    {gridRows.reduce((s, r) => s + r.totalReq, 0).toFixed(2)}
                                </td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default function CoverageDetailsPage() {
    return (
        <Suspense fallback={<div className="p-10 text-center">Caricamento...</div>}>
            <CoverageDetailsContent />
        </Suspense>
    );
}
