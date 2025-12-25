import React, { useState, useEffect } from 'react';
import api from '../util/api';

export default function AssenzePage() {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [candidates, setCandidates] = useState(null);
    const [selectedShift, setSelectedShift] = useState(null);

    useEffect(() => {
        loadShifts();
    }, [date]);

    async function loadShifts() {
        setLoading(true);
        try {
            const res = await api.getSchedule(date, date);
            setShifts(res);
        } catch (e) {
            alert("Errore: " + e.message);
        } finally {
            setLoading(false);
        }
    }

    async function markAbsent(asn) {
        if (!confirm(`Segnare ${asn.staff?.nome} come assente per questo turno?`)) return;
        try {
            // 1. Create Unavailability
            await api.upsertUnavailability({
                staffId: asn.staffId,
                data: date,
                tipo: parseInt(asn.start_time.split(':')[0]) < 17 ? 'PRANZO' : 'SERA',
                reason: 'ASSENZA GIUSTIFICATA'
            });
            // 2. Delete Assignment
            await api.deleteAssignment(asn.id);

            alert("Assenza registrata. Ora cerchiamo un sostituto.");

            // 3. Propose replacement logic
            findReplacement(asn);
            loadShifts();
        } catch (e) {
            alert("Errore: " + e.message);
        }
    }

    async function findReplacement(asn) {
        setSelectedShift(asn);
        setCandidates(null);
        try {
            const res = await api.findCandidates(date, asn.start_time, asn.end_time, asn.postazione);
            setCandidates(res);
        } catch (e) {
            alert("Errore ricerca sostituti: " + e.message);
        }
    }

    async function assignReplacement(staffId) {
        try {
            await api.createAssignment({
                staffId,
                data: date,
                start_time: selectedShift.start_time,
                end_time: selectedShift.end_time,
                postazione: selectedShift.postazione,
                status: false // Draft
            });
            alert("Sostituto assegnato (in bozza/yellow)!");
            setCandidates(null);
            setSelectedShift(null);
            loadShifts();
        } catch (e) {
            alert("Errore assegnazione: " + e.message);
        }
    }

    return (
        <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>🚑 Gestione Assenze & Sostituzioni</h2>
                <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
            </div>

            <div className="card" style={{ padding: '0' }}>
                <table className="table">
                    <thead>
                        <tr>
                            <th>Dipendente</th>
                            <th>Orario</th>
                            <th>Postazione</th>
                            <th>Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="4">Caricamento...</td></tr>
                        ) : shifts.length === 0 ? (
                            <tr><td colSpan="4" style={{ textAlign: 'center' }}>Nessun turno assegnato per questa data.</td></tr>
                        ) : (
                            shifts.map(s => (
                                <tr key={s.id}>
                                    <td><strong>{s.staff?.nome} {s.staff?.cognome}</strong></td>
                                    <td>{s.start_time} - {s.end_time}</td>
                                    <td>{s.postazione}</td>
                                    <td>
                                        <button className="btn" style={{ background: '#f44336', color: 'white' }} onClick={() => markAbsent(s)}>
                                            ❓ Assente
                                        </button>
                                        <button className="btn" style={{ marginLeft: '10px' }} onClick={() => findReplacement(s)}>
                                            🔍 Sostituisci
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {selectedShift && (
                <div style={{ marginTop: '30px', background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
                    <h3>Sostituti per {selectedShift.postazione} ({selectedShift.start_time}-{selectedShift.end_time})</h3>
                    {!candidates ? (
                        <p>Ricerca in corso...</p>
                    ) : candidates.length === 0 ? (
                        <p style={{ color: 'red' }}>Nessun sostituto disponibile trovato.</p>
                    ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                            {candidates.map(c => (
                                <div key={c.id} style={{ border: '1px solid #2196f3', padding: '10px', borderRadius: '5px', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '120px' }}>
                                    <strong>{c.nome}</strong>
                                    <small>{c.ruolo}</small>
                                    <button className="btn" style={{ marginTop: '10px', background: '#4caf50', color: 'white', padding: '5px 10px' }} onClick={() => assignReplacement(c.id)}>
                                        Assegna
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <button className="btn" style={{ marginTop: '20px', background: '#ccc' }} onClick={() => { setSelectedShift(null); setCandidates(null); }}>
                        Chiudi
                    </button>
                </div>
            )}
        </div>
    );
}
