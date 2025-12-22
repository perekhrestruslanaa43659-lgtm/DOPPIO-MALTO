
import React, { useState, useEffect } from 'react'
import api from '../util/api'

export default function AvailabilityPage() {
    const [staff, setStaff] = useState([])
    const days = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
    const fullDays = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

    // Options for availability: 'SI' (Empty/Default), 'NO' (Red), 'PREF' (Green)?
    // User said "disponibilita oraria". Let's assume they want to say if someone CAN work.
    // Let's use: "" (Si), "NO", "FIX" (Fisso)
    const options = [
        { val: '', label: 'SI', color: 'transparent' },
        { val: 'NO', label: 'NO', color: '#ffcdd2' },
        { val: 'FIX', label: 'FISSO', color: '#c8e6c9' }
    ]

    useEffect(() => {
        loadData()
    }, [])

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

    const openModal = (s, d, suffix, currentVal) => {
        const key = `${d}_${suffix}`
        // Detect Type
        let type = 'SI'
        let sTime = ''
        let eTime = ''
        let reason = ''

        if (currentVal && currentVal.startsWith('NO')) {
            type = 'NO'
            if (currentVal.includes('|')) {
                reason = currentVal.split('|')[1]
            }
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
    }

    const handleLocalChange = (sId, key, val) => {
        setLocalShifts(prev => ({ ...prev, [`${sId}_${key}`]: val }))
    }

    const saveModal = () => {
        let finalVal = ''
        if (modalType === 'NO') {
            finalVal = 'NO'
            if (modalReason && modalReason.trim()) {
                finalVal += `|${modalReason.trim()}`
            }
        }
        else if (modalType === 'FIX') finalVal = 'FIX'
        else if (modalType === 'RANGE') {
            if (modalStart && modalEnd) finalVal = `${modalStart}-${modalEnd}`
            else finalVal = ''
        }

        if (editingCell) {
            handleLocalChange(editingCell.staffId, editingCell.key, finalVal)
            saveChange(editingCell.staffId, editingCell.key, finalVal)
            setEditingCell(null)
        }
    }

    const saveChange = async (sId, key, val) => {
        // Find staff
        const sIdx = staff.findIndex(x => x.id === sId)
        if (sIdx === -1) return

        // Immutable Update
        const newStaff = [...staff]
        const oldStaff = newStaff[sIdx]

        // Use provided val or fallback to localShifts (legacy input support)
        const valueToSave = val !== undefined ? val : localShifts[`${sId}_${key}`]

        const updatedFixed = { ...(oldStaff.fixedShifts || {}), [key]: valueToSave }
        /* 
           CRITICO: Assicurati che updatedFixed non abbia undefined. 
           Inoltre, se la chiave ha lo spazio, deve essere preservato.
        */

        newStaff[sIdx] = { ...oldStaff, fixedShifts: updatedFixed }

        // Optimistic UI update
        setStaff(newStaff)

        try {
            await api.updateStaff(sId, { fixedShifts: updatedFixed })
            // Optional: harmless toast or small checkmark. 
            // For now, let's NOT alert on every success to avoid spamming "Salvato!" 28 times if they fill grid.
            // But user REQUESTED trigger for errors? 
            // "prova creare i trigger degli errori" - maybe they WANT to know if it fails OR succeeds?
            // I will log success and only alert error.
            console.log("Saved successfully")
        } catch (e) {
            console.error("Save failed:", e)
            alert("❌ Errore Salvataggio: " + e.message)
        }
    }

    const getCell = (s, d, suffix) => {
        const key = `${d}_${suffix}`
        const uniqueKey = `${s.id}_${key}`
        const val = localShifts[uniqueKey] !== undefined ? localShifts[uniqueKey] : (s.fixedShifts[key] || '')

        let text = val
        let color = '#333'
        let bg = 'transparent'
        let tooltip = ''

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
            bg = '#e3f2fd';
            color = '#1565c0';
            // Format range (e.g. 18:00-26:00 -> 18:00-02:00)
            const [s, e] = val.split('-');
            const fmt = (t) => {
                if (!t) return '';
                const [h, m] = t.split(':').map(Number);
                const h24 = h % 24;
                return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            };
            text = `${fmt(s)}-${fmt(e)}`;
        } // Range

        return (
            <td key={key}
                onClick={() => openModal(s, d, suffix, val)}
                title={tooltip}
                style={{
                    padding: '8px', border: '1px solid #eee', textAlign: 'center',
                    background: bg, color: color, cursor: 'pointer', fontWeight: '500'
                }}
            >
                {text || <span style={{ color: '#999' }}>-</span>}
                {tooltip && <div style={{ fontSize: '0.7em', color: '#b71c1c' }}>{tooltip}</div>}
            </td>
        )
    }

    return (
        <div className="panel">
            <h2>Disponibilità Oraria (Pranzo / Sera)</h2>
            <p style={{ color: '#666', fontSize: '0.9em' }}>
                Clicca su una cella per modificare la disponibilità.
            </p>

            <div className="table-container">
                <table className="table" style={{ fontSize: '0.85em' }}>
                    <thead>
                        <tr>
                            <th rowSpan={2} style={{ width: '50px' }}>ID</th>
                            <th rowSpan={2} style={{ width: '150px' }}>Nome</th>
                            {fullDays.map(d => (
                                <th key={d} colSpan={2} style={{ textAlign: 'center', borderLeft: '1px solid #ddd' }}>
                                    {d}
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
                    <div style={{ background: 'white', padding: '20px', borderRadius: '8px', minWidth: '350px', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
                        <h3 style={{ marginTop: 0 }}>Modifica Disponibilità</h3>
                        <p style={{ marginBottom: '20px' }}>
                            <strong>{editingCell.staffName}</strong> <br />
                            {editingCell.day} - {editingCell.suffix === 'P' ? 'Pranzo' : 'Sera'}
                        </p>

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
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                                <label style={{ flex: 1 }}>
                                    Da
                                    <input type="time" className="input" style={{ width: '100%' }} value={modalStart} onChange={e => setModalStart(e.target.value)} />
                                </label>
                                <label style={{ flex: 1 }}>
                                    A
                                    <input type="time" className="input" style={{ width: '100%' }} value={modalEnd} onChange={e => setModalEnd(e.target.value)} />
                                </label>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                            <button className="btn" style={{ background: '#eee', color: '#333' }} onClick={() => setEditingCell(null)}>Annulla</button>
                            <button className="btn" style={{ background: '#28a745', color: 'white' }} onClick={saveModal}>Salva</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
