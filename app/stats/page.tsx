
'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { BarChart, Calendar, User, Download, RefreshCw, AlertCircle } from 'lucide-react';

interface Staff {
    id: number;
    nome: string;
    cognome: string;
}

interface StatRow {
    name: string;
    absences: number;
    hours: string;
    details: string;
}

export default function AbsencesStatsPage() {
    const [stats, setStats] = useState<StatRow[]>([]);
    const [period, setPeriod] = useState({ start: '', end: '' });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Default: Current Month
        const date = new Date();
        const first = new Date(date.getFullYear(), date.getMonth(), 1);
        const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        // Adjust for timezone offset if needed, but local ISO string is fine for defaults
        const start = formatDate(first);
        const end = formatDate(last);
        setPeriod({ start, end });
    }, []);

    const formatDate = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    useEffect(() => {
        if (period.start && period.end) calculateStats();
    }, [period]); // Dependency on period ensures auto-reload on change

    const calculateStats = async () => {
        if (!period.start || !period.end) return;
        setLoading(true);
        try {
            const [staffList, unavail] = await Promise.all([
                api.getStaff(),
                api.getUnavailability(period.start, period.end)
            ]);

            const relevantUnavail = (unavail as any[]).filter(u => u.data >= period.start && u.data <= period.end);

            const report: StatRow[] = (staffList as Staff[]).map(s => {
                const myUnavail = relevantUnavail.filter(u => u.staffId === s.id);
                let totalHours = 0;
                let daysArr = 0;

                myUnavail.forEach(u => {
                    daysArr++;
                    if (u.start_time && u.end_time) {
                        const [h1, m1] = u.start_time.split(':').map(Number);
                        const [h2, m2] = u.end_time.split(':').map(Number);
                        let diff = (h2 + m2 / 60) - (h1 + m1 / 60);
                        if (diff < 0) diff += 24;
                        totalHours += diff;
                    } else if (u.tipo === 'TOTALE') {
                        totalHours += 8;
                    } else if (u.tipo === 'PRANZO' || u.tipo === 'SERA') {
                        totalHours += 4;
                    }
                });

                return {
                    name: `${s.nome} ${s.cognome}`,
                    absences: daysArr,
                    hours: totalHours.toFixed(2),
                    details: myUnavail.map(u => {
                        const d = u.data.split('T')[0];
                        return `${d}: ${u.tipo}${u.start_time ? ` (${u.start_time}-${u.end_time})` : ''} - ${u.reason || ''}`;
                    }).join('; ')
                };
            });

            // Sort by absences
            report.sort((a, b) => b.absences - a.absences);
            setStats(report);

        } catch (e: any) {
            console.error(e);
            alert("Errore calcolo statistiche: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const downloadCSV = () => {
        if (stats.length === 0) return;
        const header = ["Staff", "Giorni Assenza", "Ore Assenza", "Dettagli"];
        const rows = stats.map(s => `"${s.name}",${s.absences},${s.hours},"${s.details}"`);
        const csvContent = "data:text/csv;charset=utf-8," + header.join(",") + "\n" + rows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `statistiche_assenze_${period.start}_${period.end}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-sm gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
                        <BarChart className="text-blue-600" />
                        Statistiche Assenze
                    </h1>
                    <p className="text-gray-500 mt-1">Report assenze dipendenti per periodo</p>
                </div>
                <div className="flex gap-4 items-center bg-gray-50 p-2 rounded-lg">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">Dal:</span>
                        <input type="date" className="p-1 border rounded bg-white text-sm" value={period.start} onChange={e => setPeriod({ ...period, start: e.target.value })} />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">Al:</span>
                        <input type="date" className="p-1 border rounded bg-white text-sm" value={period.end} onChange={e => setPeriod({ ...period, end: e.target.value })} />
                    </div>
                    <button onClick={calculateStats} className="p-2 ml-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition" title="Ricalcola">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Highlights */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center"><AlertCircle /></div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Totale Giorni Assenza</p>
                        <p className="text-2xl font-bold text-gray-800">{stats.reduce((acc, curr) => acc + curr.absences, 0)}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center"><Calendar /></div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Media Giorni / Staff</p>
                        <p className="text-2xl font-bold text-gray-800">{(stats.reduce((acc, curr) => acc + curr.absences, 0) / (stats.length || 1)).toFixed(1)}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-700">Dettaglio per Dipendente</h3>
                    <button onClick={downloadCSV} className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition text-sm font-medium">
                        <Download size={16} /> Esporta CSV
                    </button>
                </div>
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100 text-gray-500 uppercase font-semibold text-xs">
                        <tr>
                            <th className="p-4">Dipendente</th>
                            <th className="p-4 text-center">Giorni Assenza</th>
                            <th className="p-4 text-center">Ore Assenza (Stimate)</th>
                            <th className="p-4">Dettagli</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {loading && <tr><td colSpan={4} className="p-8 text-center text-gray-400">Calcolo in corso...</td></tr>}
                        {!loading && stats.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-gray-400">Nessun dato trovato per il periodo selezionato.</td></tr>}
                        {stats.map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50 transition">
                                <td className="p-4 font-medium text-gray-900 flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold">
                                        {row.name.charAt(0)}
                                    </div>
                                    {row.name}
                                </td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded font-bold ${row.absences > 5 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                                        {row.absences}
                                    </span>
                                </td>
                                <td className="p-4 text-center font-mono text-gray-600">{row.hours}</td>
                                <td className="p-4 text-xs text-gray-500 max-w-xs truncate" title={row.details}>
                                    {row.details}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
