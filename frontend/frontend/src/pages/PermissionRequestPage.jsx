import React, { useState, useEffect } from 'react';
import api from '../util/api';
import { useAuth } from '../context/AuthContext';

export default function PermissionRequestPage() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN';

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        data: new Date().toISOString().split('T')[0],
        tipo: 'PERMESSO',
        motivo: ''
    });

    // Filter state (admin only)
    const [filterStatus, setFilterStatus] = useState('ALL');

    useEffect(() => {
        loadRequests();
    }, [filterStatus]);

    async function loadRequests() {
        setLoading(true);
        try {
            const params = {};
            if (filterStatus !== 'ALL') params.status = filterStatus;

            const data = await api.getPermissionRequests(params);
            setRequests(data);
        } catch (e) {
            alert('Errore caricamento richieste: ' + e.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();

        if (!formData.motivo.trim()) {
            alert('Inserisci una motivazione');
            return;
        }

        try {
            // Find staff ID for current user
            const staffList = await api.getStaff();
            const myStaff = staffList.find(s => s.email === user.email);

            if (!myStaff) {
                alert('Errore: Staff non trovato per questo utente');
                return;
            }

            await api.createPermissionRequest({
                staffId: myStaff.id,
                data: formData.data,
                tipo: formData.tipo,
                motivo: formData.motivo
            });

            alert('✅ Richiesta inviata! Riceverai una notifica quando l\'admin risponderà.');
            setShowForm(false);
            setFormData({
                data: new Date().toISOString().split('T')[0],
                tipo: 'PERMESSO',
                motivo: ''
            });
            loadRequests();
        } catch (e) {
            alert('Errore invio richiesta: ' + e.message);
        }
    }

    async function handleApprove(request) {
        const response = prompt('Risposta (opzionale):');

        try {
            await api.approveRequest(request.id, response || 'Approvato');
            alert('✅ Richiesta approvata!');
            loadRequests();
        } catch (e) {
            alert('Errore: ' + e.message);
        }
    }

    async function handleReject(request) {
        const response = prompt('Motivo rifiuto (obbligatorio):');

        if (!response || !response.trim()) {
            alert('Devi inserire un motivo per il rifiuto');
            return;
        }

        try {
            await api.rejectRequest(request.id, response);
            alert('❌ Richiesta rifiutata');
            loadRequests();
        } catch (e) {
            alert('Errore: ' + e.message);
        }
    }

    const statusBadge = {
        PENDING: { bg: '#ff9800', text: 'In Attesa', icon: '⏳' },
        APPROVED: { bg: '#4caf50', text: 'Approvato', icon: '✅' },
        REJECTED: { bg: '#f44336', text: 'Rifiutato', icon: '❌' }
    };

    const tipoBadge = {
        PERMESSO: { bg: '#2196f3', text: 'Permesso' },
        DISPONIBILITA: { bg: '#9c27b0', text: 'Indisponibilità' },
        CAMBIO_TURNO: { bg: '#ff5722', text: 'Cambio Turno' }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>📋 Gestione Richieste</h2>

                {!isAdmin && (
                    <button
                        className="btn"
                        style={{ background: '#2196f3', color: 'white' }}
                        onClick={() => setShowForm(!showForm)}
                    >
                        {showForm ? 'Chiudi' : '+ Nuova Richiesta'}
                    </button>
                )}
            </div>

            {/* Form Nuova Richiesta (solo utenti) */}
            {!isAdmin && showForm && (
                <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                    <h3>Nuova Richiesta</h3>
                    <form onSubmit={handleSubmit}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Data</label>
                                <input
                                    type="date"
                                    className="input"
                                    value={formData.data}
                                    onChange={e => setFormData({ ...formData, data: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Tipo</label>
                                <select
                                    className="input"
                                    value={formData.tipo}
                                    onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                                >
                                    <option value="PERMESSO">Permesso</option>
                                    <option value="DISPONIBILITA">Indisponibilità</option>
                                    <option value="CAMBIO_TURNO">Cambio Turno</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Motivazione</label>
                            <textarea
                                className="input"
                                value={formData.motivo}
                                onChange={e => setFormData({ ...formData, motivo: e.target.value })}
                                rows="3"
                                placeholder="Descrivi il motivo della richiesta..."
                                required
                            />
                        </div>

                        <button type="submit" className="btn" style={{ background: '#4caf50', color: 'white' }}>
                            Invia Richiesta
                        </button>
                    </form>
                </div>
            )}

            {/* Filtri Admin */}
            {isAdmin && (
                <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                    <button
                        className={filterStatus === 'ALL' ? 'btn active' : 'btn'}
                        onClick={() => setFilterStatus('ALL')}
                    >
                        Tutte
                    </button>
                    <button
                        className={filterStatus === 'PENDING' ? 'btn active' : 'btn'}
                        style={{ background: filterStatus === 'PENDING' ? '#ff9800' : undefined }}
                        onClick={() => setFilterStatus('PENDING')}
                    >
                        ⏳ In Attesa
                    </button>
                    <button
                        className={filterStatus === 'APPROVED' ? 'btn active' : 'btn'}
                        style={{ background: filterStatus === 'APPROVED' ? '#4caf50' : undefined, color: filterStatus === 'APPROVED' ? 'white' : undefined }}
                        onClick={() => setFilterStatus('APPROVED')}
                    >
                        ✅ Approvate
                    </button>
                    <button
                        className={filterStatus === 'REJECTED' ? 'btn active' : 'btn'}
                        style={{ background: filterStatus === 'REJECTED' ? '#f44336' : undefined, color: filterStatus === 'REJECTED' ? 'white' : undefined }}
                        onClick={() => setFilterStatus('REJECTED')}
                    >
                        ❌ Rifiutate
                    </button>
                </div>
            )}

            {/* Lista Richieste */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Caricamento...</div>
            ) : requests.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#999', border: '2px dashed #ddd', borderRadius: '8px' }}>
                    Nessuna richiesta trovata
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {requests.map(req => (
                        <div
                            key={req.id}
                            style={{
                                border: '1px solid #ddd',
                                borderLeft: `5px solid ${statusBadge[req.status].bg}`,
                                padding: '20px',
                                borderRadius: '8px',
                                background: '#fff',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                                <div>
                                    <h3 style={{ margin: '0 0 5px 0' }}>
                                        {isAdmin && `${req.staff.nome} ${req.staff.cognome || ''}`}
                                        {!isAdmin && 'La tua richiesta'}
                                    </h3>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <span style={{
                                            background: tipoBadge[req.tipo].bg,
                                            color: 'white',
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            fontSize: '0.85em',
                                            fontWeight: 'bold'
                                        }}>
                                            {tipoBadge[req.tipo].text}
                                        </span>
                                        <span style={{ color: '#666', fontSize: '0.9em' }}>
                                            📅 {new Date(req.data).toLocaleDateString('it-IT')}
                                        </span>
                                    </div>
                                </div>

                                <span style={{
                                    background: statusBadge[req.status].bg,
                                    color: 'white',
                                    padding: '6px 16px',
                                    borderRadius: '20px',
                                    fontSize: '0.9em',
                                    fontWeight: 'bold',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {statusBadge[req.status].icon} {statusBadge[req.status].text}
                                </span>
                            </div>

                            <div style={{ marginBottom: '15px' }}>
                                <strong style={{ color: '#555' }}>Motivazione:</strong>
                                <p style={{ margin: '5px 0', color: '#333' }}>{req.motivo || 'Nessuna motivazione fornita'}</p>
                            </div>

                            {req.adminResponse && (
                                <div style={{ background: '#f0f7ff', padding: '12px', borderRadius: '5px', borderLeft: '3px solid #2196f3' }}>
                                    <strong style={{ color: '#1565c0' }}>Risposta Admin:</strong>
                                    <p style={{ margin: '5px 0', color: '#333' }}>{req.adminResponse}</p>
                                    {req.processedByUser && (
                                        <small style={{ color: '#666' }}>
                                            da {req.processedByUser.name} il {new Date(req.processedAt).toLocaleString('it-IT')}
                                        </small>
                                    )}
                                </div>
                            )}

                            {isAdmin && req.status === 'PENDING' && (
                                <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                                    <button
                                        className="btn"
                                        style={{ background: '#4caf50', color: 'white', flex: 1 }}
                                        onClick={() => handleApprove(req)}
                                    >
                                        ✅ Approva
                                    </button>
                                    <button
                                        className="btn"
                                        style={{ background: '#f44336', color: 'white', flex: 1 }}
                                        onClick={() => handleReject(req)}
                                    >
                                        ❌ Rifiuta
                                    </button>
                                </div>
                            )}

                            <div style={{ marginTop: '10px', fontSize: '0.8em', color: '#999', textAlign: 'right' }}>
                                Richiesta inviata il {new Date(req.createdAt).toLocaleString('it-IT')}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
