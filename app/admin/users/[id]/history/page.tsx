'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Shield, Clock, Smartphone, Globe } from 'lucide-react';
import Link from 'next/link';

interface LoginLog {
    id: number;
    eventType: string;
    ipAddress: string | null;
    userAgent: string | null;
    isNewDevice: boolean;
    createdAt: string;
}

export default function UserHistoryPage({ params }: { params: { id: string } }) {
    const [logs, setLogs] = useState<LoginLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async () => {
        try {
            const res = await fetch(`/api/admin/users/${params.id}/logs`);
            if (!res.ok) throw new Error('Errore caricamento storico');
            const data = await res.json();
            setLogs(data.logs);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto min-h-screen bg-gray-50">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <Shield className="text-indigo-600" size={32} />
                        Storico Accessi
                    </h1>
                    <p className="text-gray-500 mt-2">Log delle attività e dei dispositivi per l'utente.</p>
                </div>
                <Link href="/admin/users" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium">
                    <ArrowLeft size={20} /> Torna alla Lista
                </Link>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : error ? (
                <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                            <tr>
                                <th className="p-4 border-b">Evento</th>
                                <th className="p-4 border-b">Data e Ora</th>
                                <th className="p-4 border-b">Dispositivo</th>
                                <th className="p-4 border-b">Indirizzo IP</th>
                                <th className="p-4 border-b">Stato</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-500">
                                        Nessuna attività registrata.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50 transition">
                                        <td className="p-4 font-medium text-gray-900">
                                            {log.eventType}
                                        </td>
                                        <td className="p-4 text-gray-600 flex items-center gap-2">
                                            <Clock size={16} className="text-gray-400" />
                                            {new Date(log.createdAt).toLocaleString('it-IT')}
                                        </td>
                                        <td className="p-4 text-sm text-gray-600 max-w-xs truncate" title={log.userAgent || ''}>
                                            <div className="flex items-center gap-2">
                                                <Smartphone size={16} className="text-gray-400" />
                                                {log.userAgent || 'Sconosciuto'}
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm font-mono text-gray-600">
                                            <div className="flex items-center gap-2">
                                                <Globe size={16} className="text-gray-400" />
                                                {log.ipAddress || 'N/A'}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {log.isNewDevice ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                    Nuovo Dispositivo
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    Dispositivo Noto
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
