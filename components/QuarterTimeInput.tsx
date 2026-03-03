import React, { useState, useEffect, useRef } from 'react';

interface QuarterTimeInputProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    id?: string;
    onEnter?: () => void;
}

export default function QuarterTimeInput({ value, onChange, label, id, onEnter }: QuarterTimeInputProps) {
    const [localValue, setLocalValue] = useState(value || '');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setLocalValue(value || '');
    }, [value]);

    const normalizeTime = (input: string): string => {
        const clean = input.replace(/[^0-9:]/g, '');
        if (!clean) return '';

        let h = 0, m = 0;

        if (clean.includes(':')) {
            const parts = clean.split(':');
            h = parseInt(parts[0] || '0');
            m = parseInt(parts[1] || '0');
        } else {
            // "1200" -> 12:00, "9" -> 09:00, "930" -> 09:30
            if (clean.length <= 2) {
                h = parseInt(clean);
            } else {
                h = parseInt(clean.slice(0, -2));
                m = parseInt(clean.slice(-2));
            }
        }

        h = Math.min(23, Math.max(0, h));
        m = Math.min(59, Math.max(0, m));

        // Round to nearest 15? Or just allow any? 
        // User asked for "QuarterTimeInput", implies 15m steps.
        // But typing "12:10" might be valid? Let's stick to 15m steps on arrows, but allow typing any valid time on blur?
        // Let's formatting HH:mm on blur. 
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const adjustTime = (deltaMinutes: number) => {
        let current = normalizeTime(localValue || '00:00');
        const [hStr, mStr] = current.split(':');
        let totalMinutes = parseInt(hStr) * 60 + parseInt(mStr);

        totalMinutes += deltaMinutes;

        // Loop around day
        if (totalMinutes < 0) totalMinutes += 24 * 60;
        if (totalMinutes >= 24 * 60) totalMinutes -= 24 * 60;

        const newH = Math.floor(totalMinutes / 60);
        const newM = totalMinutes % 60;

        const newVal = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
        setLocalValue(newVal);
        onChange(newVal);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            adjustTime(15);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            adjustTime(-15);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            handleBlur();
            if (onEnter) onEnter();
        }
    };

    const handleBlur = () => {
        const normalized = normalizeTime(localValue);
        setLocalValue(normalized);
        onChange(normalized);
    };

    return (
        <div className="flex flex-col gap-1">
            {label && <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>}
            <div className="relative group">
                <input
                    ref={inputRef}
                    id={id}
                    type="text"
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    placeholder="HH:MM"
                    className="w-24 p-2 text-center border-2 border-gray-200 rounded-lg text-lg font-bold text-gray-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all"
                />

                {/* Visual Arrow Indicators (Clickable) */}
                <div className="absolute right-0 top-0 bottom-0 flex flex-col border-l border-gray-200 w-6">
                    <button
                        tabIndex={-1}
                        onClick={() => adjustTime(15)}
                        className="flex-1 hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-indigo-600 transition-colors rounded-tr-md"
                    >
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor"><path d="M5 0L0 5H10L5 0Z" /></svg>
                    </button>
                    <button
                        tabIndex={-1}
                        onClick={() => adjustTime(-15)}
                        className="flex-1 hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-indigo-600 transition-colors rounded-br-md border-t border-gray-100"
                    >
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor"><path d="M5 6L10 1H0L5 6Z" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
