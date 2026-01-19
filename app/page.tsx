
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link'; // Import Link from next/link
import { api } from '@/lib/api';
import {
    Calendar, Users, Clock, AlertCircle,
    BarChart2, FileText, ArrowRight, ShieldCheck,
    Coffee
} from 'lucide-react';

export default function Dashboard() {
    const [user, setUser] = useState<any>(null);
    const [pendingRequests, setPendingRequests] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const u = await api.getProfile() as any;
                setUser(u);

                // If admin/manager, load pending requests count
                if (u.role === 'ADMIN' || u.role === 'MANAGER') {
                    // We might not have a specific count endpoint in api.ts yet, 
                    // but we have getPermissionRequests we can filter or a specific one.
                    // Checking api.ts... we added getPendingRequestsCount!
                    try {
                        const count = await api.getPendingRequestsCount().catch(() => ({ count: 0 })) as any;
                        setPendingRequests(count.count || 0);
                    } catch (e) {
                        // Fallback if endpoint fails
                    }
                }
            } catch (e) {
                console.error("Dashboard load error", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const cards = [
        {
            title: 'Calendario Turni',
            desc: 'Gestisci la pianificazione settimanale',
            href: '/calendar',
            icon: <Calendar className="text-blue-600" size={24} />,
            color: 'bg-blue-50'
        },
        {
            title: 'Personale',
            desc: 'Anagrafica e gestione staff',
            href: '/staff',
            icon: <Users className="text-emerald-600" size={24} />,
            color: 'bg-emerald-50'
        },
        {
            title: 'Richieste',
            desc: 'Ferie e permessi',
            href: '/requests',
            icon: <FileText className="text-purple-600" size={24} />,
            color: 'bg-purple-50',
            badge: pendingRequests > 0 ? pendingRequests : null
        },
        {
            title: 'Forecast & Budget',
            desc: 'Analisi costi e previsioni',
            href: '/forecast',
            icon: <BarChart2 className="text-orange-600" size={24} />,
            color: 'bg-orange-50'
        }
    ];

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <header className="mb-12 animate-fade-in-down">
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-4xl font-extrabold text-slate-900 flex items-center gap-3 tracking-tight">
                            <Coffee className="text-indigo-600" size={40} />
                            ScheduFlow
                        </h1>
                        <p className="text-slate-500 mt-2 text-lg font-light">
                            Benvenuto, <span className="font-semibold text-indigo-600">{user?.name}</span>!
                        </p>
                    </div>
                </div>
            </header>

            {/* Navigation Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {cards.map((card, idx) => (
                    <Link
                        key={card.href}
                        href={card.href}
                        className="group relative block p-8 bg-white/80 backdrop-blur-md rounded-2xl shadow-xl shadow-indigo-100/50 border border-white/50 hover:shadow-2xl hover:shadow-indigo-200/50 hover:-translate-y-1 transition-all duration-300 ring-1 ring-slate-900/5"
                    >
                        <div className={`w-14 h-14 rounded-2xl ${card.color} flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                            {card.icon}
                        </div>
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-slate-800 text-xl mb-2 group-hover:text-indigo-600 transition-colors">
                                    {card.title}
                                </h3>
                                <p className="text-sm text-slate-500 leading-relaxed font-medium">
                                    {card.desc}
                                </p>
                            </div>
                            {card.badge && (
                                <span className="bg-rose-100 text-rose-600 text-xs font-bold px-3 py-1 rounded-full animate-pulse shadow-sm">
                                    {card.badge}
                                </span>
                            )}
                        </div>
                        <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-x-2 group-hover:translate-x-0">
                            <ArrowRight size={20} className="text-indigo-400" />
                        </div>
                    </Link>
                ))}
            </div>

            {/* Recent Activity or Info Section */}
            <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white/90 backdrop-blur-sm p-8 rounded-3xl shadow-lg border border-slate-100">
                    <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-3 text-lg">
                        <ShieldCheck size={24} className="text-emerald-500" />
                        Stato Sistema
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-sm font-medium text-slate-600">Ruolo Utente</span>
                            <span className="font-mono text-xs font-bold bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full">{user?.role}</span>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="text-sm font-medium text-slate-600">Tenant ID</span>
                            <span className="font-mono text-xs font-bold bg-slate-200 text-slate-600 px-3 py-1 rounded-full truncate max-w-[150px]">{user?.tenantKey || 'N/A'}</span>
                        </div>
                        <div className="text-xs text-center text-slate-400 mt-6 font-medium uppercase tracking-widest">
                            v2.2.0 • ScheduFlow
                        </div>
                    </div>
                </div>

                <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-3xl shadow-2xl text-white">
                    <div className="relative z-10">
                        <h3 className="font-bold text-2xl mb-2 flex items-center gap-2">AI Assistant <BotIcon /></h3>
                        <p className="text-indigo-100 text-base mb-8 max-w-sm leading-relaxed">
                            Il tuo assistente virtuale è pronto. Chiedi analisi, suggerimenti sui turni o ottimizzazioni.
                        </p>
                        <Link href="/ai" className="inline-flex items-center gap-2 bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition shadow-lg hover:shadow-xl active:scale-95 transform duration-200">
                            Avvia Chat <ArrowRight size={18} />
                        </Link>
                    </div>
                    {/* Decorative Blob */}
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-purple-500/30 rounded-full blur-2xl"></div>
                </div>
            </div>
        </div>
    );
}

function BotIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
    );
}
