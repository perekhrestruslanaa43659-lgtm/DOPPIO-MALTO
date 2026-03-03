
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    Calendar, Users, Clock, DollarSign, BarChart2,
    Bot, FileText, Settings, LogOut, Menu, X,
    CalendarDays, UserPlus, Coffee, Briefcase, Shield
} from 'lucide-react';
import { api } from '@/lib/api';

export default function Navigation({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false); // Desktop collapse state
    const [user, setUser] = useState<any>(null);

    const isAuthPage = pathname === '/login' || pathname === '/register';

    useEffect(() => {
        if (!isAuthPage) {
            api.getProfile().then(setUser).catch(() => router.push('/login'));
        }
    }, [pathname]);

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
                { label: 'Regole', href: '/regole', icon: <Shield size={20} /> },
            ]
        },
        {
            title: 'ANALISI',
            items: [
                { label: 'Statistiche', href: '/stats', icon: <PieChartIcon size={20} /> },
                { label: 'Chiusure', href: '/closings', icon: <FileText size={20} /> },
            ]
        }
    ];

    // Define user-accessible items
    const userAllowedPaths = ['/calendar', '/requests', '/dashboard', '/profile'];

    // Filter groups based on role
    const filteredMenuGroups = menuGroups.map(group => {
        // If Admin, return full group (or specific admin groups added below)
        if (user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'OWNER') {
            return group;
        }

        // If User, filter items
        const filteredItems = group.items.filter(item => userAllowedPaths.includes(item.href));
        if (filteredItems.length > 0) {
            return {
                ...group,
                items: filteredItems
            };
        }
        return null;
    }).filter(Boolean); // Remove empty groups

    if (user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'OWNER') {
        // Add Admin-specific group
        // Note: We modifying a filtered list locally, so we push to the new list
        (filteredMenuGroups as any[]).push({
            title: 'GESTIONE',
            items: [
                { label: 'Gestione Utenti', href: '/users', icon: <Users size={20} /> },
                { label: 'Impostazioni', href: '/settings', icon: <Settings size={20} /> }
            ]
        });
    }

    // Flatten menu items for keyboard navigation
    const allMenuItems = React.useMemo(() => {
        return (filteredMenuGroups as any[]).flatMap(group => group.items);
    }, [filteredMenuGroups]);

    const userMenuItems = React.useMemo(() => {
        return [];
    }, []);

    const navigableItems = [...allMenuItems, ...userMenuItems];

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (
                document.activeElement instanceof HTMLInputElement ||
                document.activeElement instanceof HTMLTextAreaElement ||
                (document.activeElement as HTMLElement).isContentEditable
            ) {
                return;
            }

            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const currentIndex = navigableItems.findIndex(item => pathname.startsWith(item.href));
                let nextIndex = 0;

                if (e.key === 'ArrowDown') {
                    nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % navigableItems.length;
                } else if (e.key === 'ArrowUp') {
                    nextIndex = currentIndex === -1 ? navigableItems.length - 1 : (currentIndex - 1 + navigableItems.length) % navigableItems.length;
                }

                const target = navigableItems[nextIndex];
                if (target) {
                    router.push(target.href);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [pathname, navigableItems, router]);


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

    return (
        <div className="flex bg-gray-50 dark:bg-gray-950 min-h-screen transition-all duration-300">
            {/* Mobile Overlay */}
            {isOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsOpen(false)} />}

            {/* Sidebar */}
            <aside className={`
                fixed md:sticky top-0 left-0 z-50 h-screen 
                ${isCollapsed ? 'w-20' : 'w-64'}
                bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950
                dark:from-slate-950 dark:via-black dark:to-black
                text-gray-100 border-r border-slate-800/50 shadow-xl
                transition-all duration-300 ease-in-out shrink-0 flex flex-col
                ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                <div className={`h-20 flex items-center ${isCollapsed ? 'justify-center px-0' : 'justify-between px-6'} border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-sm shrink-0 transition-all duration-300`}>

                    {!isCollapsed && (
                        <div className="flex items-center gap-3 group">
                            <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-2 rounded-xl shadow-lg shadow-blue-900/20 group-hover:shadow-blue-900/40 transition-all duration-300 group-hover:scale-105">
                                <CalendarDays size={22} className="text-white" />
                            </div>
                            <span className="font-bold text-xl tracking-tight text-white group-hover:text-blue-200 transition-colors whitespace-nowrap">
                                Schedu<span className="text-blue-400">Flow</span>
                            </span>
                        </div>
                    )}

                    {/* Desktop Collapse Toggle */}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className={`hidden md:flex text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5 ${isCollapsed ? 'mx-auto' : ''}`}
                        title={isCollapsed ? "Espandi menu" : "Riduci menu"}
                    >
                        {isCollapsed ? (
                            <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-2 rounded-xl shadow-lg">
                                <CalendarDays size={22} className="text-white" />
                            </div>
                        ) : (
                            <Menu size={20} className="transform rotate-0" /> // Using Menu or similar icon for toggle
                        )}
                        {/* Specifically requested "Grid Button" to hide - Using LayoutGrid if preferred, or just Menu/Arrow */}
                    </button>

                    <button onClick={() => setIsOpen(false)} className="md:hidden text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto py-6 px-3 space-y-8 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent hover:scrollbar-thumb-slate-600 overflow-x-hidden">
                    <nav className="space-y-8">
                        {(filteredMenuGroups as any[]).map((group, idx) => (
                            <div key={idx}>
                                {!isCollapsed && (
                                    <h3 className="px-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3 whitespace-nowrap opacity-100 transition-opacity duration-300">
                                        {group.title}
                                    </h3>
                                )}
                                <div className="space-y-1">
                                    {group.items.map((item) => {
                                        const isActive = pathname.startsWith(item.href);
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                onClick={() => setIsOpen(false)}
                                                title={isCollapsed ? item.label : ''}
                                                className={`
                                                    relative group flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200
                                                    ${isActive
                                                        ? 'bg-blue-500/20 text-white shadow-sm ring-1 ring-blue-400/30'
                                                        : 'text-slate-400 hover:bg-white/5 hover:text-white'}
                                                    ${isCollapsed ? 'justify-center px-2' : ''}
                                                `}
                                            >
                                                {/* Active dot indicator */}
                                                {isActive && !isCollapsed && (
                                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-400 rounded-r-full" />
                                                )}

                                                <span className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                                                    {item.icon}
                                                </span>

                                                {!isCollapsed && (
                                                    <span className="tracking-wide whitespace-nowrap opacity-100 transition-opacity duration-200">
                                                        {item.label}
                                                    </span>
                                                )}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </nav>
                </div>

                <div className={`p-4 border-t border-slate-800/50 bg-slate-900/30 backdrop-blur-sm mt-auto ${isCollapsed ? 'p-2' : 'p-4'}`}>
                    <div className={`bg-slate-800/50 rounded-xl border border-slate-700/50 ${isCollapsed ? 'p-2 flex flex-col items-center gap-2' : 'p-1'}`}>
                        {isCollapsed ? (
                            // Collapsed Profile View
                            <>
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-md ring-2 ring-slate-700/50" title={user?.name}>
                                    {user?.name?.substring(0, 2).toUpperCase() || 'AD'}
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                    title="Esci"
                                >
                                    <LogOut size={18} />
                                </button>
                            </>
                        ) : (
                            // Expanded Profile View
                            <>
                                <div className="px-3 py-3 flex items-center gap-3 mb-1">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-md ring-2 ring-slate-700/50">
                                        {user?.name?.substring(0, 2).toUpperCase() || 'AD'}
                                    </div>
                                    <div className="overflow-hidden flex-1">
                                        <p className="text-sm font-semibold text-white truncate leading-tight">{user?.name} {user?.surname}</p>
                                        <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 truncate mt-0.5">{user?.role || 'Admin'}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg text-xs font-semibold transition-all duration-200 group"
                                >
                                    <LogOut size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                                    Esci
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 w-full flex flex-col min-w-0 bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
                {/* Mobile Header */}
                <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 md:hidden flex items-center justify-between px-4 sticky top-0 z-30 transition-colors duration-300">
                    <button onClick={() => setIsOpen(true)} className="text-gray-600 dark:text-gray-300">
                        <Menu size={24} />
                    </button>
                    <span className="font-bold text-gray-800 dark:text-white">ScheduFlow</span>
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
