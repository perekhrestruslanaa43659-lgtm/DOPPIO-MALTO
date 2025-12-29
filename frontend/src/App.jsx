import React, { useState } from 'react'
import StaffPage from './pages/StaffPage'
import TurniPage from './pages/TurniPage'
import IndisponibilitaPage from './pages/IndisponibilitaPage'
import AvailabilityPage from './pages/AvailabilityPage'
import BudgetPage from './pages/BudgetPage'
import CoveragePage from './pages/CoveragePage'
import AiAgentPage from './pages/AiAgentPage'

import StatisticsPage from './pages/StatisticsPage'
import UsersPage from './pages/UsersPage'
import ProfilePage from './pages/ProfilePage'
import FixedShiftsPage from './pages/FixedShiftsPage'
import AssenzePage from './pages/AssenzePage'
import ForecastPage from './pages/ForecastPage'

import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'

const MainContent = () => {
  const { user, loading, logout } = useAuth();
  const [tab, setTab] = useState('staff');

  // Set default tab based on role
  React.useEffect(() => {
    if (user && user.role !== 'ADMIN' && tab === 'staff') {
      setTab('turni');
    }
  }, [user]);

  if (loading) return <div>Loading...</div>;
  if (!user) return <LoginPage />;

  const isAdmin = user.role === 'ADMIN';

  const headerStyle = {
    background: '#ffffff',
    padding: '0 20px',
    height: '70px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    position: 'sticky',
    top: 0,
    zIndex: 1000
  };

  const logoStyle = {
    fontSize: '1.5rem',
    fontWeight: '800',
    background: 'linear-gradient(90deg, #1a237e 0%, #0d47a1 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: '-1px'
  };

  const userMenuContainer = {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    background: '#f8f9fa',
    padding: '8px 15px',
    borderRadius: '30px',
    border: '1px solid #e9ecef'
  };

  const roleBadge = {
    fontSize: '0.65rem',
    background: isAdmin ? '#e65100' : '#2e7d32',
    color: 'white',
    padding: '2px 8px',
    borderRadius: '10px',
    fontWeight: 'bold',
    marginLeft: '8px',
    verticalAlign: 'middle',
    letterSpacing: '0.5px'
  };

  const tabsContainer = {
    display: 'flex',
    gap: '5px',
    overflowX: 'auto',
    paddingBottom: '0px'
  };

  return (
    <div className="app" style={{ backgroundColor: '#f4f6f8', minHeight: '100vh' }}>
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <h1 style={logoStyle}>ScheduFlow</h1>
          {/* Desktop Nav */}
          <nav style={tabsContainer}>
            {isAdmin && <button className={tab === 'staff' ? 'btn active' : 'btn'} onClick={() => setTab('staff')}>Staff</button>}
            <button className={tab === 'turni' ? 'btn active' : 'btn'} onClick={() => setTab('turni')}>Turni</button>
            <button className={tab === 'assenze' ? 'btn active' : 'btn'} style={{ background: '#f44336', color: '#fff' }} onClick={() => setTab('assenze')}>🚑 Assenze</button>
            <button className={tab === 'indis' ? 'btn active' : 'btn'} onClick={() => setTab('indis')}>Inserimento</button>

            {isAdmin && <button className={tab === 'stats' ? 'btn active' : 'btn'} onClick={() => setTab('stats')}>Statistiche</button>}
            {isAdmin && <button className={tab === 'forecast' ? 'btn active' : 'btn'} style={{ background: '#fbc02d', color: '#000' }} onClick={() => setTab('forecast')}>📊 Forecast</button>}
            {isAdmin && <button className={tab === 'coverage' ? 'btn active' : 'btn'} style={{ background: '#e91e63', color: '#fff' }} onClick={() => setTab('coverage')}>Fabbisogno</button>}
            {isAdmin && <button className={tab === 'users' ? 'btn active' : 'btn'} style={{ background: '#2d3748', color: '#fff' }} onClick={() => setTab('users')}>Utenti</button>}
            {isAdmin && <button className={tab === 'agent' ? 'btn active' : 'btn'} style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'none' }} onClick={() => setTab('agent')}>✨ AI Agent</button>}
          </nav>
        </div>

        <div style={userMenuContainer}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: '1.2' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#333' }}>
              {user.name} <span style={roleBadge}>{isAdmin ? 'MANAGER' : 'OPERATORE'}</span>
            </span>
            <span style={{ fontSize: '0.75rem', color: '#777' }}>{user.email}</span>
          </div>

          <div style={{ borderLeft: '1px solid #ddd', paddingLeft: '15px', display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setTab('profile')}
              title="Profilo"
              style={{
                padding: '8px',
                borderRadius: '50%',
                background: tab === 'profile' ? '#e3f2fd' : 'transparent',
                color: tab === 'profile' ? '#1565c0' : '#555',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </button>
            <button
              onClick={logout}
              title="Logout"
              style={{
                padding: '8px',
                borderRadius: '50%',
                background: '#ffebee',
                color: '#c62828',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
          </div>
        </div>
      </header>
      <main>
        {tab === 'staff' && isAdmin && <StaffPage />}
        {tab === 'turni' && <TurniPage readOnly={!isAdmin} />}
        {tab === 'assenze' && <AssenzePage />}
        {tab === 'indis' && <IndisponibilitaPage />}

        {tab === 'stats' && isAdmin && <StatisticsPage />}
        {tab === 'budget' && isAdmin && <BudgetPage />}
        {tab === 'forecast' && isAdmin && <ForecastPage />}
        {tab === 'coverage' && isAdmin && <CoveragePage />}
        {tab === 'users' && isAdmin && <UsersPage />}
        {tab === 'agent' && isAdmin && <AiAgentPage />}
        {tab === 'profile' && <ProfilePage />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  )
}
