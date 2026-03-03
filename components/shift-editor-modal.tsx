
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Clock, MapPin, Check, Briefcase, User, FileText } from 'lucide-react';
import QuarterTimeInput from './QuarterTimeInput';

interface ShiftTemplate {
    id: number;
    nome: string;
    oraInizio: string;
    oraFine: string;
}

interface ShiftEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (shiftTemplateId: string | number, start: string, end: string, station: string, note: string) => void;
    staffName: string;
    date: string; // YYYY-MM-DD
    type: string; // "PRANZO" or "SERA" or combined
    currentAssignment?: {
        shiftTemplateId?: number;
        start_time?: string;
        end_time?: string;
        postazione?: string;
        note?: string;
    };
    templates: ShiftTemplate[];
}

export const ShiftEditorModal: React.FC<ShiftEditorModalProps> = ({
    isOpen,
    onClose,
    onSave,
    staffName,
    date,
    type,
    currentAssignment,
    templates
}) => {
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | number>('');
    const [customTimes, setCustomTimes] = useState({ start: '', end: '' });
    const [selectedStation, setSelectedStation] = useState('');
    const [note, setNote] = useState('');

    // Stations list - could be passed as prop later
    const STATIONS = ['BARGIU', 'BARSU', 'ACCSU', 'CDR', 'B/S', 'CUCINA', 'MANAGER', 'PASS', 'Jolly', 'LAVAGGIO', 'SUPPORTO NAVIGLI'];

    // Initialize state when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedTemplateId(currentAssignment?.shiftTemplateId || '');

            // Smart Defaults if no assignment
            const isLunchType = type.toLowerCase().includes('pranzo');
            const defaultStart = isLunchType ? '12:00' : '19:00';
            const defaultEnd = isLunchType ? '15:00' : '23:00';

            setCustomTimes({
                start: currentAssignment?.start_time || defaultStart,
                end: currentAssignment?.end_time || defaultEnd
            });
            setSelectedStation(currentAssignment?.postazione || '');
            setNote(currentAssignment?.note || '');
        }
    }, [isOpen, currentAssignment, type]);

    if (!isOpen) return null;

    const isLunch = type.toLowerCase().includes('pranzo') || (customTimes.start && parseInt(customTimes.start) < 16);
    const themeColor = isLunch ? 'orange' : 'indigo';
    const ThemeIcon = isLunch ? User : MapPin; // Just placeholder logic

    const handleTemplateSelect = (t: ShiftTemplate) => {
        setSelectedTemplateId(t.id);
        setCustomTimes({ start: t.oraInizio, end: t.oraFine });
    };

    const handleSave = () => {
        onSave(selectedTemplateId, customTimes.start, customTimes.end, selectedStation, note);
        onClose();
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop with Blur */}
            <div
                className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className={`px-6 py-4 bg-gradient-to-r ${isLunch ? 'from-orange-500 to-amber-500' : 'from-indigo-600 to-purple-600'} text-white`}>
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                {staffName}
                            </h2>
                            <p className="text-white/80 text-sm font-medium mt-1">
                                {new Date(date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full transition text-white"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">

                    {/* Time Selection Section */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                            <Clock size={14} /> Orario & Turno
                        </label>

                        {/* Presets Grid */}
                        {templates.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => {
                                        setSelectedTemplateId('MANUAL');
                                        setCustomTimes({ start: '', end: '' });
                                        setSelectedStation('');
                                    }}
                                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition text-left
                                        ${selectedTemplateId === 'MANUAL' || (!selectedTemplateId && !currentAssignment?.shiftTemplateId)
                                            ? `bg-${themeColor}-100 border-${themeColor}-500 text-${themeColor}-700 ring-1 ring-${themeColor}-500`
                                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    Manuale / Libero
                                </button>
                                {templates.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => handleTemplateSelect(t)}
                                        className={`px-3 py-2 text-sm font-medium rounded-lg border transition text-left flex flex-col
                                            ${selectedTemplateId === t.id
                                                ? `bg-${themeColor}-50 border-${themeColor}-500 text-${themeColor}-700 ring-1 ring-${themeColor}-500`
                                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <span className="font-bold">{t.nome}</span>
                                        <span className="text-xs opacity-70">{t.oraInizio} - {t.oraFine}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-400 text-sm italic">Nessun turno predefinito disponibile.</p>
                        )}

                        {/* Visual Time Inputs */}
                        <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100 mt-2">
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Inizio</label>
                                <input
                                    type="time"
                                    value={customTimes.start}
                                    onChange={(e) => {
                                        setCustomTimes(prev => ({ ...prev, start: e.target.value }));
                                        setSelectedTemplateId('MANUAL');
                                    }}
                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-lg font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div className="text-gray-300 font-bold text-xl">→</div>
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Fine</label>
                                <input
                                    type="time"
                                    value={customTimes.end}
                                    onChange={(e) => {
                                        setCustomTimes(prev => ({ ...prev, end: e.target.value }));
                                        setSelectedTemplateId('MANUAL');
                                    }}
                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-lg font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Station Selection */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                            <MapPin size={14} /> Postazione
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {STATIONS.map(s => (
                                <button
                                    key={s}
                                    onClick={() => setSelectedStation(s)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition
                                        ${selectedStation === s
                                            ? `bg-${themeColor}-100 border-${themeColor}-500 text-${themeColor}-700`
                                            : 'bg-transparent border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                        }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Note Input */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                            <FileText size={14} /> Note / Commento
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Es. Nome supporto, dettagli..."
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                            rows={2}
                        />
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleSave}
                        className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg shadow-${themeColor}-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2
                             bg-gradient-to-r ${isLunch ? 'from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700' : 'from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'}
                        `}
                    >
                        <Check size={20} />
                        Salva Turno
                    </button>

                    {/* Remove/Clear Button (Only if exists) */}
                    {currentAssignment?.start_time && (
                        <button
                            onClick={() => {
                                onSave('', '', '', '', ''); // Clear
                                onClose();
                            }}
                            className="w-full py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition font-medium"
                        >
                            Rimuovi Turno
                        </button>
                    )}

                </div>
            </div>
        </div>,
        document.body
    );
};
