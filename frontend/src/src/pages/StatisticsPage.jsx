import React, { useEffect, useState } from 'react'
import api from '../util/api'

export default function StatisticsPage() {
    const [staffList, setStaffList] = useState([]);
    const [stats, setStats] = useState([]);
    const [period, setPeriod] = useState({ start: '', end: '' });

    useEffect(() => {
        api.getStaff().then(setStaffList);
        // Default period: Current Month
        const date = new Date();
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        setPeriod({
            start: firstDay.toISOString().split('T')[0],
            end: lastDay.toISOString().split('T')[0]
        });
    }, []);

    useEffect(() => {
        if (period.start && period.end) calculateStats();
    }, [period, staffList]);

    async function calculateStats() {
        if (staffList.length === 0) return;

        try {
            // Fetch all data for period
            // We need Unavailability AND Schedule to calculate %.
            // Currently API endpoints are separate.
            // Let's fetch all Unavailability.
            const unavail = await api.getUnavailability();

            // Filter unavail by date range
            const relevantUnavail = unavail.filter(u => u.data >= period.start && u.data <= period.end);

            // Calculate per staff
            const report = staffList.map(s => {
                const myUnavail = relevantUnavail.filter(u => u.staffId === s.id);

                let totalHoursAbsence = 0;
                let daysAbsence = 0;

                myUnavail.forEach(u => {
                    daysAbsence++;
                    if (u.start_time && u.end_time) {
                        const h1 = parseInt(u.start_time.split(':')[0]);
                        const m1 = parseInt(u.start_time.split(':')[1] || 0);
                        const h2 = parseInt(u.end_time.split(':')[0]);
                        const m2 = parseInt(u.end_time.split(':')[1] || 0);
                        let diff = (h2 + m2 / 60) - (h1 + m1 / 60);
                        if (diff < 0) diff += 24;
                        totalHoursAbsence += Math.round(diff * 100) / 100;
                    } else if (u.tipo === 'TOTALE') {
                        totalHoursAbsence += 8;
                    } else if (u.tipo === 'PRANZO' || u.tipo === 'SERA') {
                        totalHoursAbsence += 4; // Mid-day fallback
                    }
                });

                return {
                    name: `${s.nome} ${s.cognome}`,
                    absences: daysAbsence,
                    hours: totalHoursAbsence.toFixed(2),
                    details: myUnavail.map(u => {
                        const datePart = u.data ? u.data.split('T')[0] : '';
                        return `${datePart}: ${u.tipo}${u.start_time ? ` (${u.start_time}-${u.end_time})` : ''}`;
                    }).join('; ')
                };
            });

            setStats(report);

        } catch (e) {
            console.error(e);
        }
    }

    function downloadCSV() {
        if (stats.length === 0) return;
        const headers = ["Staff", "Giorni Assenza", "Ore Assenza", "Dettagli"];
        const rows = stats.map(s => [s.name, s.absences, s.hours, s.details]);

        let csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `statistiche_assenze_${period.start}_${period.end}.csv`);
        document.body.appendChild(link);
        link.click();
    }

    return (
        <div className="panel">
            <h2>Statistiche Assenze</h2>
            <div className="form-row">
                <div>
                    <label>Dal</label>
                    <input type="date" className="input" value={period.start} onChange={e => setPeriod({ ...period, start: e.target.value })} />
                </div>
                <div>
                    <label>Al</label>
                    <input type="date" className="input" value={period.end} onChange={e => setPeriod({ ...period, end: e.target.value })} />
                </div>
                <button className="btn" onClick={calculateStats}>Ricalcola</button>
                <button className="btn" onClick={downloadCSV} style={{ background: '#008CBA' }}>Esporta CSV</button>
            </div>

            <table className="table">
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Giorni Assenza</th>
                        <th>Ore Assenza (Stimate)</th>
                        <th>Dettagli</th>
                    </tr>
                </thead>
                <tbody>
                    {stats.map((row, i) => (
                        <tr key={i}>
                            <td>{row.name}</td>
                            <td>{row.absences}</td>
                            <td>{row.hours}</td>
                            <td style={{ fontSize: '0.8em', color: '#666' }}>{row.details.substring(0, 50)}...</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
