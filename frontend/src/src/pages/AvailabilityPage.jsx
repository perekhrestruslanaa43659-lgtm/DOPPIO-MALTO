
import React, { useState, useEffect } from 'react'
import api from '../util/api'
import QuarterTimeInput from '../components/QuarterTimeInput'

// Helper: Get Range from Week Number (ISO) - STRICT MONDAY START
function getWeekRange(w, year = 2025) {
    const d = new Date(Date.UTC(year, 0, 4)); // Jan 4th is always in Week 1
    const day = d.getUTCDay() || 7;
    const startOfYear = new Date(d);
    startOfYear.setUTCDate(d.getUTCDate() - day + 1);
    const startD = new Date(startOfYear);
    startD.setUTCDate(startOfYear.getUTCDate() + (w - 1) * 7);
    const start = startD.toISOString().split('T')[0];
    const endD = new Date(startD);
    endD.setUTCDate(endD.getUTCDate() + 6);
    return { start, startD };
}

export default function AvailabilityPage() {
    const [staff, setStaff] = useState([])
    const fullDays = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

    // State for Week Navigation
    const [currentYear, setCurrentYear] = useState(2025)
    const [selectedWeek, setSelectedWeek] = useState(42)
    const [weekDates, setWeekDates] = useState([])

    const [assignments, setAssignments] = useState([])

    useEffect(() => {
        // Calculate dates for the week headers
        const { startD } = getWeekRange(selectedWeek, currentYear)
        const dates = []
        for (let i = 0; i < 7; i++) {
            const d = new Date(startD)
            d.setDate(d.getDate() + i)
            dates.push(d) // keep as Date object for formatting
        }
        setWeekDates(dates)

        loadData()
    }, [selectedWeek, currentYear]) // reload when week changes

    // Helper to reload just assignments if needed (or full reload)
    useEffect(() => {
        if (weekDates.length > 0) {
            const start = weekDates[0].toISOString().split('T')[0];
            const end = weekDates[6].toISOString().split('T')[0];
            api.getSchedule(start, end).then(setAssignments).catch(console.error);
        }
    }, [weekDates]);

    // Navigation
    const changeWeek = (delta) => {
        let newW = selectedWeek + delta
        let newY = currentYear
        if (newW > 52) { newW = 1; newY++; }
        if (newW < 1) { newW = 52; newY--; }
        setSelectedWeek(newW)
        setCurrentYear(newY)
    }

    async function loadData() {
        try {
            const res = await api.getStaff()
            // Ensure fixedShifts is an object
            const mapped = res.map(s => ({
                ...s,
                fixedShifts: s.fixedShifts || {}
            }))
            // Sort by listIndex or name
            mapped.sort((a, b) => (a.listIndex || 999) - (b.listIndex || 999))
            setStaff(mapped)

            // Load Assignments for current week override
            if (weekDates.length > 0) {
                const start = weekDates[0].toISOString().split('T')[0];
                const end = weekDates[6].toISOString().split('T')[0];
                const schedule = await api.getSchedule(start, end);
                setAssignments(schedule);
            }
        } catch (e) {
            alert(e.message)
        }
    }

    const [localShifts, setLocalShifts] = useState({})

    useEffect(() => {
        if (staff.length > 0) {
            const init = {}
            staff.forEach(s => {
                const fs = s.fixedShifts || {}
                Object.keys(fs).forEach(k => {
                    init[`${s.id}_${k}`] = fs[k]
                })
            })
            setLocalShifts(init)
        }
    }, [staff])

    const [editingCell, setEditingCell] = useState(null) // { staffId, key, staffName, day, suffix, val }
    const [modalReason, setModalReason] = useState('')
    const [modalType, setModalType] = useState('SI')
    const [modalStart, setModalStart] = useState('')
    const [modalEnd, setModalEnd] = useState('')
    const [modalVal, setModalVal] = useState('')

    const [modalScope, setModalScope] = useState('single') // single, daily_range, permanent, weekly_range
    const [modalStartDate, setModalStartDate] = useState('')
    const [modalEndDate, setModalEndDate] = useState('')
    const [modalStartWeek, setModalStartWeek] = useState(0)
    const [modalEndWeek, setModalEndWeek] = useState(0)

    const openModal = (s, d, suffix, currentVal) => {
        const key = `${d}_${suffix}`
        let type = 'SI'
        let sTime = ''
        let eTime = ''
        let reason = ''

        if (currentVal && currentVal.startsWith('NO')) {
            type = 'NO'
            if (currentVal.includes('|')) reason = currentVal.split('|')[1]
        }
        else if (currentVal === 'FIX') type = 'FIX'
        else if (currentVal && currentVal.includes('-')) {
            type = 'RANGE'
            const [start, end] = currentVal.split('-')
            sTime = start
            eTime = end
        }

        setEditingCell({ staffId: s.id, key, staffName: `${s.nome} ${s.cognome}`, day: d, suffix })
        setModalType(type)
        setModalStart(sTime)
        setModalEnd(eTime)
        setModalReason(reason)
        setModalVal(currentVal)

        // Defaults
        setModalScope('single')
        setModalStartDate('')
        setModalEndDate('')
        // Default weeks to current selected week
        setModalStartWeek(selectedWeek)
        setModalEndWeek(selectedWeek + 1)
    }

    const transmit = async () => {
        if (!confirm("Sei sicuro di voler pubblicare i turni per questa settimana (Bozza -> Pubblicato)?")) return;
        if (weekDates.length === 0) return;

        try {
            const start = weekDates[0].toISOString().split('T')[0];
            const end = weekDates[6].toISOString().split('T')[0];
            const res = await api.publishAssignments({ startDate: start, endDate: end });
            alert(`Trasmessi ${res.count} turni!`);
            loadData();
        } catch (e) {
            alert("Errore trasmissione: " + e.message);
        }
    }

    const saveModal = async (force = false) => {
        if (!editingCell) return

        // 1. Validation
        if (modalType === 'RANGE' && !modalEnd) {
            alert("⚠️ Per favore, inserisci l'orario di fine turno.")
            return
        }
        if (modalScope === 'daily_range' && !modalEndDate) {
            alert("⚠️ Per favore, inserisci la data di fine periodo.")
            return
        }
        if (modalScope === 'weekly_range' && (!modalStartWeek || !modalEndWeek)) {
            alert("⚠️ Per favore, inserisci le settimane di inizio e fine.")
            return
        }

        // 2. Prepare Payload
        const dayMap = { 'Lunedì': 0, 'Martedì': 1, 'Mercoledì': 2, 'Giovedì': 3, 'Venerdì': 4, 'Sabato': 5, 'Domenica': 6 }
        const targetIdx = dayMap[editingCell.day];

        let targetDateStr = '';
        let endDateStr = '';

        if (modalScope === 'daily_range') {
            // Use modalStartDate (if set) or current cell date
            const currentCellDate = weekDates[targetIdx].toISOString().split('T')[0];
            targetDateStr = modalStartDate ? modalStartDate : currentCellDate;
            endDateStr = modalEndDate;
        }
        else if (modalScope === 'weekly_range') {
            // Calculate dates from weeks
            const { start: s1 } = getWeekRange(modalStartWeek, currentYear);
            const { start: s2 } = getWeekRange(modalEndWeek, currentYear); // Start of end week
            // actually we want end of end week? usually yes.
            // getWeekRange returns startD.
            const d2 = new Date(s2);
            d2.setDate(d2.getDate() + 6); // End of that week

            targetDateStr = s1;
            endDateStr = d2.toISOString().split('T')[0];
        }
        else {
            // single or permanent
            const targetDate = weekDates[targetIdx];
            targetDateStr = targetDate.toISOString().split('T')[0];
            endDateStr = targetDateStr;
        }

        try {
            const res = await api.saveAvailability({
                staffId: editingCell.staffId,
                startDate: targetDateStr,
                endDate: endDateStr,
                startTime: modalStart,
                endTime: modalEnd,
                type: modalType,
                scope: modalScope,
                reason: modalReason,
                dayIndex: targetIdx === 6 ? 0 : targetIdx + 1, // DB 0=Sun
                suffix: editingCell.suffix,
                force: force
            });

            if (res.warning) {
                if (confirm(res.msg)) {
                    await saveModal(true); // Retry with force
                }
                return;
            }

            // Refresh
            loadData();
            setEditingCell(null);

            if (!force) {
                const targetDateObj = new Date(targetDateStr);
                // Check if target date is in current views
                const viewStart = weekDates[0];
                const viewEnd = weekDates[6];

                if (targetDateObj < viewStart || targetDateObj > viewEnd) {
                    if (confirm("Disponibilità salvata correttamente (Bozza)!\n\nLa data modificata (" + targetDateStr + ") è fuori dalla settimana corrente. Vuoi andare a quella settimana?")) {
                        // Jump to week
                        // Simple estimation or use getWeekNumber logic if available, 
                        // but for now let's just use the Input logic or reload? 
                        // Actually we have changeWeek, but that's relative.
                        // We can use helper to finding ISO week number.
                        const d = new Date(targetDateStr);
                        // Copy getWeekNumber logic or similar
                        const date = new Date(d.valueOf());
                        date.setHours(0, 0, 0, 0);
                        date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
                        const week1 = new Date(date.getFullYear(), 0, 4);
                        const weekNum = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);

                        setSelectedWeek(weekNum);
                        setCurrentYear(d.getFullYear());
                    }
                } else {
                    alert("Disponibilità salvata correttamente!");
                }
            }
        } catch (e) {
            alert("Errore: " + e.message);
        }
    }


    const getCell = (s, d, suffix) => {
        const key = `${d}_${suffix}`
        const uniqueKey = `${s.id}_${key}`

        // 1. Check for specific Assignment first (Override)
        const dayMap = { 'Lunedì': 0, 'Martedì': 1, 'Mercoledì': 2, 'Giovedì': 3, 'Venerdì': 4, 'Sabato': 5, 'Domenica': 6 }
        const idx = dayMap[d];
        const dateObj = weekDates[idx]

        let assignmentVal = null;
        let isDraft = false;

        if (dateObj) {
            const dateStr = dateObj.toISOString().split('T')[0];

            // 1a. Check Unavailability (Slot Aware)
            const unavail = (s.unavailabilities || []).find(u => {
                const uDate = u.data ? u.data.split('T')[0] : '';
                if (uDate !== dateStr) return false;
                if (u.tipo === 'TOTALE') return true;
                if (u.tipo === 'PRANZO' && suffix === 'P') return true;
                if (u.tipo === 'SERA' && suffix === 'S') return true;
                if (u.tipo === 'PARZIALE' && u.start_time) {
                    const h = parseInt(u.start_time.split(':')[0]);
                    if (suffix === 'P' && h < 17) return true;
                    if (suffix === 'S' && h >= 17) return true;
                }
                return false;
            });

            if (unavail) {
                return (
                    <td key={key} style={{ padding: '8px', border: '1px solid #eee', textAlign: 'center', background: '#ffebee', color: '#c62828', fontWeight: 'bold', fontSize: '0.75em' }}>
                        INDISPONIBILE
                        {unavail.reason && <div style={{ fontSize: '0.8em', fontWeight: 'normal' }}>({unavail.reason})</div>}
                    </td>
                );
            }

            // 1b. Filter assignments

            const match = assignments.find(a => {
                if (a.staffId !== s.id || a.data !== dateStr) return false;

                // Determine if assignment is Pranzo or Sera based on start time
                let startT = a.start_time || (a.shiftTemplate ? a.shiftTemplate.oraInizio : '00:00');
                const h = parseInt(startT.split(':')[0]);
                const isPranzo = h < 17;

                return (suffix === 'P' && isPranzo) || (suffix === 'S' && !isPranzo);
            });

            if (match) {
                assignmentVal = `${match.start_time || ''}-${match.end_time || ''}`;
                if (!assignmentVal || assignmentVal === '-') {
                    if (match.shiftTemplate) {
                        assignmentVal = `${match.shiftTemplate.oraInizio}-${match.shiftTemplate.oraFine}`;
                    }
                }

                if (match.status === false) isDraft = true;
            }
        }

        // 2. Fallback to Fixed Shifts
        const fixedVal = localShifts[uniqueKey] !== undefined ? localShifts[uniqueKey] : (s.fixedShifts[key] || '')

        const val = assignmentVal || fixedVal;

        let text = val
        let color = '#333'
        let bg = 'transparent'
        let tooltip = ''
        let border = '1px solid #eee'

        if (isDraft) {
            border = '2px dashed #ffc107'; // Draft indicator
            bg = '#fff3cd';
        }

        if (val && val.toUpperCase().startsWith('NO')) {
            bg = '#ffcdd2';
            color = '#c62828';
            if (val.includes('|')) {
                const parts = val.split('|')
                text = 'NO'
                tooltip = parts[1]
            } else {
                text = 'NO'
            }
        }
        else if (val && val.toUpperCase() === 'FIX') { bg = '#c8e6c9'; text = 'FISSO'; color = '#2e7d32'; }
        else if (val && val.includes('-')) {
            if (!isDraft) {
                bg = '#e3f2fd'; // Only blue if confirmed/fixed
                color = '#1565c0';
            } else {
                bg = '#fff9c4'; // Yellow for Draft
                color = '#856404';
            }
            const [s, e] = val.split('-');
            const fmt = (t) => {
                if (!t) return '';
                const [h, m] = t.split(':').map(Number);
                const h24 = h % 24;
                return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            };
            text = `${fmt(s)}-${fmt(e)}`;
        }

        return (
            <td key={key}
                onClick={() => openModal(s, d, suffix, val)}
                title={tooltip + (isDraft ? ' (BOZZA)' : '')}
                style={{
                    padding: '8px', border: border, textAlign: 'center',
                    background: bg, color: color, cursor: 'pointer', fontWeight: '500'
                }}
            >
                {text || <span style={{ color: '#999' }}>-</span>}
                {isDraft && <span style={{ fontSize: '0.6em', display: 'block', color: '#856404', fontWeight: 'bold' }}>DA RIVEDERE</span>}
                {tooltip && <div style={{ fontSize: '0.7em', color: '#b71c1c' }}>{tooltip}</div>}
            </td>
        )
    }

    return (
        <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Disponibilità Oraria (Pranzo / Sera)</h2>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button className="btn" style={{ background: '#007bff', color: 'white' }} onClick={transmit}>🚀 Trasmetti</button>
                    <button className="btn" onClick={() => changeWeek(-1)}>◀</button>
                    <span>Settimana</span>
                    <input
                        type="number"
                        value={selectedWeek}
                        onChange={e => {
                            const w = parseInt(e.target.value) || 1;
                            setSelectedWeek(w);
                        }}
                        style={{ width: '50px', padding: '5px' }}
                    />
                    <span>({currentYear})</span>
                    <button className="btn" onClick={() => changeWeek(1)}>▶</button>
                </div>
            </div>
            <p style={{ color: '#666', fontSize: '0.9em' }}>
                Clicca su una cella per modificare la disponibilità.
            </p>

            <div className="table-container">
                <table className="table" style={{ fontSize: '0.85em' }}>
                    <thead>
                        <tr>
                            <th rowSpan={2} style={{ width: '50px' }}>ID</th>
                            <th rowSpan={2} style={{ width: '150px' }}>Nome</th>
                            {fullDays.map((d, i) => (
                                <th key={d} colSpan={2} style={{ textAlign: 'center', borderLeft: '1px solid #ddd' }}>
                                    {d} <br />
                                    <span style={{ fontSize: '0.8em', color: '#666' }}>
                                        {weekDates[i] ? weekDates[i].toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : ''}
                                    </span>
                                </th>
                            ))}
                        </tr>
                        <tr>
                            {fullDays.map(d => (
                                <React.Fragment key={d}>
                                    <th style={{ textAlign: 'center', borderLeft: '1px solid #ddd', fontSize: '0.8em', padding: '5px' }}>P</th>
                                    <th style={{ textAlign: 'center', fontSize: '0.8em', padding: '5px' }}>S</th>
                                </React.Fragment>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {staff.map(s => (
                            <tr key={s.id}>
                                <td>{s.id}</td>
                                <td style={{ fontWeight: 500 }}>{s.nome} {s.cognome}</td>
                                {fullDays.map(d => (
                                    <React.Fragment key={d}>
                                        {getCell(s, d, 'P')}
                                        {getCell(s, d, 'S')}
                                    </React.Fragment>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* MODAL */}
            {editingCell && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{ background: 'white', padding: '20px', borderRadius: '8px', minWidth: '400px', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
                        <h3 style={{ marginTop: 0 }}>Modifica Disponibilità</h3>
                        <p style={{ marginBottom: '15px' }}>
                            <strong>{editingCell.staffName}</strong> <br />
                            {editingCell.day}
                            {(() => {
                                const dayMap = { 'Lunedì': 0, 'Martedì': 1, 'Mercoledì': 2, 'Giovedì': 3, 'Venerdì': 4, 'Sabato': 5, 'Domenica': 6 };
                                const idx = dayMap[editingCell.day];
                                const d = weekDates[idx];
                                return d ? ` ${d.toLocaleDateString()}` : '';
                            })()}
                            - {editingCell.suffix === 'P' ? 'Pranzo' : 'Sera'}
                        </p>

                        <div style={{ marginBottom: '15px', padding: '10px', background: '#f8f9fa', borderRadius: '5px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Ambito di Applicazione</label>

                            {/* Level 1: Scope Type */}
                            <div style={{ display: 'flex', gap: '15px', marginBottom: '10px' }}>
                                <label>
                                    <input
                                        type="radio"
                                        name="scopeBase"
                                        checked={modalScope === 'single' || modalScope === 'daily_range'}
                                        onChange={() => setModalScope('single')}
                                    /> Giornaliero
                                </label>
                                <label>
                                    <input
                                        type="radio"
                                        name="scopeBase"
                                        checked={modalScope === 'permanent' || modalScope === 'weekly_range'}
                                        onChange={() => setModalScope('permanent')}
                                    /> Settimanale
                                </label>
                            </div>

                            {/* Level 2: Sub-options for GIORNALIERO */}
                            {(modalScope === 'single' || modalScope === 'daily_range') && (
                                <div style={{ paddingLeft: '20px', borderLeft: '3px solid #007bff' }}>
                                    <div style={{ marginBottom: '5px' }}>
                                        <label style={{ marginRight: '10px' }}>
                                            <input
                                                type="radio"
                                                name="subDaily"
                                                checked={modalScope === 'single'}
                                                onChange={() => setModalScope('single')}
                                            /> Solo questa data
                                        </label>
                                        <label>
                                            <input
                                                type="radio"
                                                name="subDaily"
                                                checked={modalScope === 'daily_range'}
                                                onChange={() => setModalScope('daily_range')}
                                            /> Periodo (Giorni)
                                        </label>
                                    </div>
                                    {modalScope === 'daily_range' && (
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '5px' }}>
                                            <div>
                                                <small>Dal (Incluso)</small>
                                                <input type="date" className="input" value={modalStartDate} onChange={e => setModalStartDate(e.target.value)} />
                                            </div>
                                            <div>
                                                <small>Al (Incluso)</small>
                                                <input type="date" className="input" value={modalEndDate} onChange={e => setModalEndDate(e.target.value)} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Level 2: Sub-options for SETTIMANALE */}
                            {(modalScope === 'permanent' || modalScope === 'weekly_range') && (
                                <div style={{ paddingLeft: '20px', borderLeft: '3px solid #28a745' }}>
                                    <div style={{ marginBottom: '5px' }}>
                                        <label style={{ marginRight: '10px' }}>
                                            <input
                                                type="radio"
                                                name="subWeekly"
                                                checked={modalScope === 'permanent'}
                                                onChange={() => setModalScope('permanent')}
                                            /> Sempre (Ricorrente)
                                        </label>
                                        <label>
                                            <input
                                                type="radio"
                                                name="subWeekly"
                                                checked={modalScope === 'weekly_range'}
                                                onChange={() => setModalScope('weekly_range')}
                                            /> Periodo (Settimane)
                                        </label>
                                    </div>
                                    {modalScope === 'weekly_range' && (
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '5px' }}>
                                            <div>
                                                <small>Da Settimana</small>
                                                <input type="number" className="input" style={{ width: '80px' }} value={modalStartWeek} onChange={e => setModalStartWeek(parseInt(e.target.value))} />
                                            </div>
                                            <div>
                                                <small>A Settimana</small>
                                                <input type="number" className="input" style={{ width: '80px' }} value={modalEndWeek} onChange={e => setModalEndWeek(parseInt(e.target.value))} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Stato</label>
                            <select
                                className="input"
                                style={{ width: '100%' }}
                                value={modalType}
                                onChange={e => setModalType(e.target.value)}
                            >
                                <option value="SI">✅ Disponibile (SI)</option>
                                <option value="NO">❌ Non Disponibile (NO)</option>
                                <option value="FIX">🔒 Fisso (FIX)</option>
                                <option value="RANGE">🕒 Fascia Oraria Specifica</option>
                            </select>
                        </div>

                        {modalType === 'NO' && (
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Motivo (Opzionale)</label>
                                <input
                                    type="text"
                                    className="input"
                                    style={{ width: '100%' }}
                                    value={modalReason}
                                    onChange={e => setModalReason(e.target.value)}
                                    placeholder="Es. Ferie, Malattia, Permesso..."
                                />
                            </div>
                        )}

                        {modalType === 'RANGE' && (
                            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', background: '#f8f9fa', padding: '10px', borderRadius: '5px' }}>
                                <div style={{ flex: 1 }}>
                                    <small style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Da</small>
                                    <QuarterTimeInput value={modalStart} onChange={setModalStart} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <small style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>A</small>
                                    <QuarterTimeInput value={modalEnd} onChange={setModalEnd} />
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                            <button className="btn" style={{ background: '#eee', color: '#333' }} onClick={() => setEditingCell(null)}>Annulla</button>
                            <button className="btn" style={{ background: '#28a745', color: 'white' }} onClick={() => saveModal(false)}>Salva</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
