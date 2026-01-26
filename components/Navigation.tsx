
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    Calendar, Users, Clock, DollarSign, BarChart2,
    Bot, FileText, Settings, LogOut, Menu, X,
    CalendarDays, UserPlus, Coffee, Briefcase
} from 'lucide-react';
import { api } from '@/lib/api';

export default function Navigation({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [user, setUser] = useState<any>(null);

    const isAuthPage = pathname === '/login' || pathname === '/register';

    useEffect(() => {
        if (!isAuthPage) {
            api.getProfile().then(setUser).catch(() => router.push('/login'));
        }
    }, [pathname]);

    const handleLogout = async () => {
        try {
            await api.logout();
            router.push('/login');
        } catch (e) {
            console.error(e);
            router.push('/login');
        }
    };

    if (isAuthPage) {
        return <>{children}</>;
    }

    const menuGroups = [
        {
            title: 'OPERATIVO',
            items: [
                { label: 'Calendario', href: '/calendar', icon: <CalendarDays size={20} /> },
                { label: 'Staff', href: '/staff', icon: <Users size={20} /> },
                { label: 'Turni Fissi', href: '/fixed-shifts', icon: <Clock size={20} /> },
                { label: 'Assenze', href: '/absences', icon: <BanIcon size={20} /> },
                { label: 'Richieste', href: '/requests', icon: <FileText size={20} /> },
            ]
        },
        {
            title: 'PIANIFICAZIONE',
            items: [
                { label: 'Forecast', href: '/forecast', icon: <BarChart2 size={20} /> },
                { label: 'Fabbisogno', href: '/requirements', icon: <Briefcase size={20} /> },
                { label: 'Budget', href: '/budget', icon: <DollarSign size={20} /> },
            ]
        },
        {
            title: 'ANALISI',
            items: [
                { label: 'Statistiche', href: '/stats', icon: <PieChartIcon size={20} /> },
                { label: 'AI Assistant', href: '/ai', icon: <Bot size={20} /> },
            ]
        }
    ];

    if (user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'OWNER') {
        menuGroups.push({
            title: 'GESTIONE',
            items: [
                { label: 'Gestione Utenti', href: '/users', icon: <Users size={20} /> },
                { label: 'Impostazioni', href: '/settings', icon: <Settings size={20} /> }
            ]
        });
    }

    return (
        <div className="flex bg-gray-50 min-h-screen">
            {/* Mobile Overlay */}
            {isOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsOpen(false)} />}

            {/* Sidebar */}
            <aside className={`
                fixed md:sticky top-0 left-0 z-50 h-screen w-64 bg-[#1e293b] text-white border-r border-[#334155]
                transform transition-transform duration-200 ease-in-out shrink-0 flex flex-col
                ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                <div className="p-6 flex justify-between items-center border-b border-[#334155] h-16 shrink-0">
                    <div className="font-bold text-xl text-white flex items-center gap-2">
                        <div className="bg-blue-600 p-1.5 rounded-lg">
                            <CalendarDays size={20} className="text-white" />
                        </div>
                        ScheduFlow
                    </div>
                    <button onClick={() => setIsOpen(false)} className="md:hidden text-gray-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto flex-1 scrollbar-hide">
                    <nav className="space-y-6">
                        {menuGroups.map((group, idx) => (
                            <div key={idx}>
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-4">
                                    {group.title}
                                </h3>
                                <div className="space-y-1">
                                    {group.items.map((item) => {
                                        const isActive = pathname.startsWith(item.href);
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                onClick={() => setIsOpen(false)}
                                                className={`
                                                    flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                                                    ${isActive
                                                        ? 'bg-blue-600/20 text-blue-400 border-l-4 border-blue-500' // Highlighting style
                                                        : 'text-gray-400 hover:bg-slate-800 hover:text-gray-100'}
                                                `}
                                            >
                                                {item.icon}
                                                {item.label}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </nav>

                    <div className="pt-4 border-t border-[#334155] mt-4">
                        <div className="px-4 py-3 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-900 text-blue-200 flex items-center justify-center font-bold">
                                {user?.name?.substring(0, 2).toUpperCase() || 'AD'}
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-bold text-white truncate">{user?.name} {user?.surname}</p>
                                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-500/10 rounded-lg text-sm font-medium transition mt-1"
                        >
                            <LogOut size={18} />
                            Logout
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 w-full flex flex-col min-w-0">
                {/* Mobile Header */}
                <header className="h-16 bg-white border-b border-gray-200 md:hidden flex items-center justify-between px-4 sticky top-0 z-30">
                    <button onClick={() => setIsOpen(true)} className="text-gray-600">
                        <Menu size={24} />
                    </button>
                    <span className="font-bold text-gray-800">ScheduFlow</span>
                    <div className="w-6" /> {/* Spacer */}
                </header>

                <div className="flex-1">
                    {children}
                </div>
            </main>
        </div>
    );
}

function BanIcon({ size }: { size: number }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" />
        </svg>
    )
}

function PieChartIcon({ size }: { size: number }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" />
        </svg>
    )
}
