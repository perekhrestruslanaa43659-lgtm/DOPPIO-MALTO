'use client';
import React, { useState, useEffect } from 'react';
import { Brain, ArrowLeft, Loader2, Database, BarChart3, TrendingUp, Upload, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface TrainingData {
    id: number;
    date: string;
    weeksStart: string;
    data: string; // JSON string
    rating: number;
}

interface Staff {
    id: number;
    nome: string;
    cognome: string;
    ruolo: string;
}

interface Insight {
    staffId: number;
    name: string;
    role: string;
    stats: {
        [dayIndex: number]: { station: string; count: number }[]; // Sorted by count desc
    };
    totalSamples: number;
}

export default function AdminTrainingPage() {
    const [loading, setLoading] = useState(true);
    const [insights, setInsights] = useState<Insight[]>([]);
    const [trainingCount, setTrainingCount] = useState(0);

    useEffect(() => {
        loadData();
    }, []);

    // [SKIP]

    const loadData = async () => {
        try {
            const [trainingData, staffList] = await Promise.all([
                api.getTrainingData(),
                api.getStaff()
            ]);

            // Validation: Ensure array
            const safeTraining = Array.isArray(trainingData) ? trainingData : [];
            const safeStaff = Array.isArray(staffList) ? staffList : [];

            setTrainingCount(safeTraining.length);
            processInsights(safeTraining, safeStaff);
        } catch (error) {
            console.error('Error loading training data:', error);
            // Optional: Set default empty state or show user alert
        } finally {
            setLoading(false);
        }
    };

    const processInsights = (training: TrainingData[], staff: Staff[]) => {
        const staffMap = new Map<number, Staff>();
        staff.forEach(s => staffMap.set(s.id, s));

        const dataMap = new Map<number, { [day: number]: Map<string, number> }>(); // StaffId -> Day -> Station -> Count

        let totalSamples = 0;

        training.forEach(td => {
            try {
                const assignments = JSON.parse(td.data);
                if (Array.isArray(assignments)) {
                    assignments.forEach((a: any) => {
                        if (!a.staffId || !a.data || !a.postazione) return;

                        const date = new Date(a.data);
                        const day = date.getDay(); // 0 = Sun, 6 = Sat
                        // Normalize station
                        const station = a.postazione.toUpperCase().trim();

                        if (!dataMap.has(a.staffId)) dataMap.set(a.staffId, {});
                        const sData = dataMap.get(a.staffId)!;

                        if (!sData[day]) sData[day] = new Map();

                        const current = sData[day].get(station) || 0;
                        sData[day].set(station, current + 1);
                        totalSamples++;
                    });
                }
            } catch (e) {
                console.error('Error parsing training row', e);
            }
        });

        // Convert to Array
        const result: Insight[] = [];
        dataMap.forEach((days, staffId) => {
            const s = staffMap.get(staffId);
            if (!s) return;

            const insight: Insight = {
                staffId,
                name: `${s.nome} ${s.cognome || ''}`.trim(),
                role: s.ruolo,
                stats: {},
                totalSamples: 0 // Local total for this staff
            };

            // Process each day
            Object.keys(days).forEach(dStr => {
                const day = parseInt(dStr);
                const stationsMap = days[day];
                const sortedStations = Array.from(stationsMap.entries())
                    .map(([station, count]) => ({ station, count }))
                    .sort((a, b) => b.count - a.count); // Descending

                insight.stats[day] = sortedStations;
                insight.totalSamples += sortedStations.reduce((acc, curr) => acc + curr.count, 0);
            });

            result.push(insight);
        });

        // Sort by Total Samples desc
        result.sort((a, b) => b.totalSamples - a.totalSamples);
        setInsights(result);
    };

    const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <Link href="/calendar" className="text-gray-500 hover:text-gray-800 flex items-center gap-2 mb-2 transition">
                            <ArrowLeft size={16} /> Torna al Calendario
                        </Link>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <Brain className="text-purple-600" size={32} />
                            Analisi Apprendimento AI
                        </h1>
                        <p className="text-gray-500 mt-1">
                            Visualizza cosa ha imparato l'algoritmo dalle sessioni di addestramento precedenti.
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-3">
                            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                                <Database size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase">Dataset</p>
                                <p className="text-2xl font-bold text-gray-800">{trainingCount}</p>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-3">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                                <BarChart3 size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase">Pattern</p>
                                <p className="text-2xl font-bold text-gray-800">{insights.length}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="animate-spin text-purple-600 mb-4" size={48} />
                        <p className="text-gray-500 font-medium">Analisi dei dati in corso...</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-xs border-b">
                                    <tr>
                                        <th className="p-4 w-[250px]">Staff</th>
                                        {days.map((d, i) => (
                                            <th key={i} className="p-4 text-center min-w-[120px]">{d}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {insights.map((insight) => (
                                        <tr key={insight.staffId} className="hover:bg-gray-50 transition">
                                            <td className="p-4">
                                                <div className="font-bold text-gray-900 text-base">{insight.name}</div>
                                                <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">{insight.role}</div>
                                                <div className="mt-1 flex items-center gap-1 text-xs text-purple-600 font-medium">
                                                    <TrendingUp size={12} />
                                                    {insight.totalSamples} campioni
                                                </div>
                                            </td>
                                            {days.map((_, dayIndex) => {
                                                const stats = insight.stats[dayIndex];
                                                const top = stats && stats[0]; // Top 1 station

                                                return (
                                                    <td key={dayIndex} className="p-4 text-center border-l border-gray-50">
                                                        {top ? (
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-bold shadow-sm border border-purple-200">
                                                                    {top.station}
                                                                </span>
                                                                <div className="text-[10px] text-gray-400 font-mono">
                                                                    {top.count} volte
                                                                    {stats.length > 1 && ` (+${stats.length - 1} altri)`}
                                                                </div>
                                                                {/* Optional: Show secondary preferences on hover? */}
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-300">-</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
