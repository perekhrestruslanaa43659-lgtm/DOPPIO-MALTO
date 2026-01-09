import React, {useEffect, useState} from 'react'
import api from '../util/api'

export default function TurniPage(){
  const [turni, setTurni] = useState([])
  useEffect(()=>{ api.getTurni().then(setTurni) },[])

  return (
    <div className="panel">
      <h2>Turni Generati</h2>
      <table className="table">
        <thead><tr><th>ID</th><th>Nome</th><th>Data</th><th>Inizio</th><th>Fine</th><th>Costo</th><th>Stato</th></tr></thead>
        <tbody>
          {turni.map(t=> (
            <tr key={t.identificativo}><td>{t.identificativo}</td><td>{t.nome}</td><td>{t.data}</td><td>{t.inizio}</td><td>{t.fine}</td><td>{t.costo_stimato}</td><td>{t.stato}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
