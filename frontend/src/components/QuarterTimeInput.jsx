import React from 'react';

export default function QuarterTimeInput({ value, onChange, label, id }) {
    // value is expected to be "HH:mm" or ""
    const [h, m] = (value || '00:00').split(':');

    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const minutes = ['00', '15', '30', '45'];

    const handleHourChange = (newH) => {
        onChange(`${newH}:${m || '00'}`);
    };

    const handleMinuteChange = (newM) => {
        onChange(`${h || '00'}:${newM}`);
    };

    return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            {label && <span style={{ fontSize: '0.85em', marginRight: '4px' }}>{label}</span>}
            <select
                value={h || '00'}
                onChange={(e) => handleHourChange(e.target.value)}
                className="input"
                style={{ width: '55px', padding: '4px' }}
            >
                {hours.map(hr => <option key={hr} value={hr}>{hr}</option>)}
            </select>
            <span style={{ fontWeight: 'bold' }}>:</span>
            <select
                value={m || '00'}
                onChange={(e) => handleMinuteChange(e.target.value)}
                className="input"
                style={{ width: '55px', padding: '4px' }}
            >
                {minutes.map(min => <option key={min} value={min}>{min}</option>)}
            </select>
            {/* Hidden input to maintain compatibility with legacy document.getElementById if needed */}
            <input type="hidden" id={id} value={`${h || '00'}:${m || '00'}`} />
        </div>
    );
}
