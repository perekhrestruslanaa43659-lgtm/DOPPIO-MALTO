import React, { useState } from 'react'
import StaffPage from './pages/StaffPage'
import TurniPage from './pages/TurniPage'
import IndisponibilitaPage from './pages/IndisponibilitaPage'
import AvailabilityPage from './pages/AvailabilityPage'
import BudgetPage from './pages/BudgetPage'
import CoveragePage from './pages/CoveragePage'
import AiAgentPage from './pages/AiAgentPage'

export default function App() {
  const [tab, setTab] = useState('staff')
  return (
    <div className="app">
      <header>
        <h1>Scheduling Dashboard</h1>
        <nav>
          <button className={tab === 'staff' ? 'btn active' : 'btn'} onClick={() => setTab('staff')}>Staff</button>
          <button className={tab === 'turni' ? 'btn active' : 'btn'} onClick={() => setTab('turni')}>Turni</button>
          <button className={tab === 'indis' ? 'btn active' : 'btn'} onClick={() => setTab('indis')}>Indisponibilità</button>
          <button className={tab === 'dispo' ? 'btn active' : 'btn'} onClick={() => setTab('dispo')}>Disponibilità</button>
          <button className={tab === 'budget' ? 'btn active' : 'btn'} style={{ background: '#fbc02d', color: '#000' }} onClick={() => setTab('budget')}>Forecast</button>
          <button className={tab === 'coverage' ? 'btn active' : 'btn'} style={{ background: '#e91e63', color: '#fff' }} onClick={() => setTab('coverage')}>Fabbisogno</button>
          <button className={tab === 'agent' ? 'btn active' : 'btn'} style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'none' }} onClick={() => setTab('agent')}>✨ AI Agent</button>
        </nav>
      </header>
      <main>
        {tab === 'staff' && <StaffPage />}
        {tab === 'turni' && <TurniPage />}
        {tab === 'indis' && <IndisponibilitaPage />}
        {tab === 'dispo' && <AvailabilityPage />}
        {tab === 'budget' && <BudgetPage />}
        {tab === 'coverage' && <CoveragePage />}
        {tab === 'agent' && <AiAgentPage />}
      </main>
    </div>
  )
}
