
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
        <div className="p-8 max-w-7xl mx-auto min-h-screen bg-gray-50">
            <header className="mb-10">
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <Coffee className="text-amber-700" size={32} />
                    Dashboard
                </h1>
                <p className="text-gray-500 mt-2 text-lg">
                    Benvenuto, <span className="font-semibold text-gray-800">{user?.name}</span>!
                </p>
            </header>

            {/* Quick Stats or Highlights could go here */}

            {/* Navigation Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card) => (
                    <Link
                        key={card.href}
                        href={card.href}
                        className="group block p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all duration-200"
                    >
                        <div className={`w-12 h-12 rounded-lg ${card.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                            {card.icon}
                        </div>
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg mb-1 group-hover:text-blue-700 transition-colors">
                                    {card.title}
                                </h3>
                                <p className="text-sm text-gray-500 leading-relaxed">
                                    {card.desc}
                                </p>
                            </div>
                            {card.badge && (
                                <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                                    {card.badge}
                                </span>
                            )}
                        </div>
                        <div className="mt-4 flex items-center text-sm font-medium text-gray-400 group-hover:text-blue-600 transition-colors">
                            Vai alla sezione <ArrowRight size={16} className="ml-1" />
                        </div>
                    </Link>
                ))}
            </div>

            {/* Recent Activity or Info Section */}
            <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <ShieldCheck size={20} className="text-gray-400" />
                        Stato Sistema
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm text-gray-600">Ruolo Utente</span>
                            <span className="font-mono text-xs font-bold bg-gray-200 px-2 py-1 rounded">{user?.role}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm text-gray-600">Tenant ID</span>
                            <span className="font-mono text-xs font-bold bg-gray-200 px-2 py-1 rounded truncate max-w-[150px]">{user?.tenantKey || 'N/A'}</span>
                        </div>
                        <div className="text-xs text-center text-gray-400 mt-4">
                            Versione App v2.0.0 (Next.js Migration)
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-xl shadow-md text-white">
                    <h3 className="font-bold text-lg mb-2">AI Assistant 🤖</h3>
                    <p className="text-indigo-100 text-sm mb-6">
                        Hai bisogno di aiuto con la pianificazione? Chiedi al nostro assistente intelligente.
                    </p>
                    <Link href="/ai" className="inline-flex items-center gap-2 bg-white text-indigo-600 px-4 py-2 rounded-lg font-bold hover:bg-indigo-50 transition">
                        Avvia Chat <ArrowRight size={16} />
                    </Link>
                </div>
            </div>
        </div>
    );
}
