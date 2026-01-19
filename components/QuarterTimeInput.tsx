
import React from 'react';

interface QuarterTimeInputProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    id?: string;
}

export default function QuarterTimeInput({ value, onChange, label, id }: QuarterTimeInputProps) {
    // value is expected to be "HH:mm" or ""
    const [h, m] = (value || '00:00').split(':');

    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const minutes = ['00', '15', '30', '45'];

    const handleHourChange = (newH: string) => {
        onChange(`${newH}:${m || '00'}`);
    };

    const handleMinuteChange = (newM: string) => {
        onChange(`${h || '00'}:${newM}`);
    };

    return (
        <div className="inline-flex items-center gap-2">
            {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
            <div className="flex items-center border rounded-md overflow-hidden bg-white">
                <select
                    value={h || '00'}
                    onChange={(e) => handleHourChange(e.target.value)}
                    className="p-1 text-sm bg-transparent border-none focus:ring-0 outline-none w-14 text-center cursor-pointer"
                >
                    {hours.map(hr => <option key={hr} value={hr}>{hr}</option>)}
                </select>
                <span className="font-bold text-gray-400">:</span>
                <select
                    value={m || '00'}
                    onChange={(e) => handleMinuteChange(e.target.value)}
                    className="p-1 text-sm bg-transparent border-none focus:ring-0 outline-none w-14 text-center cursor-pointer"
                >
                    {minutes.map(min => <option key={min} value={min}>{min}</option>)}
                </select>
            </div>
            {/* Hidden input to maintain compatibility if needed */}
            {id && <input type="hidden" id={id} value={`${h || '00'}:${m || '00'}`} />}
        </div>
    );
}
