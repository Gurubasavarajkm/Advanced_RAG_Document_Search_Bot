import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, LogOut, MessageSquare, Database } from 'lucide-react';
import './ui.css';

const Layout = () => {
  const { role, logout } = useAuth();
  const location = useLocation();

  return (
    <>
      <nav className="top-nav">
        <Link to="/" className="logo" style={{ textDecoration: 'none' }}>
          <BookOpen className="text-primary" size={28} />
          Document Search Bot
        </Link>
        <div className="nav-links">
          {role && (
            <>
              <Link 
                to="/chat" 
                className={`nav-link ${location.pathname === '/chat' ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <MessageSquare size={18} /> Chat
              </Link>
              {role === 'admin' && (
                <Link 
                  to="/admin" 
                  className={`nav-link ${location.pathname === '/admin' ? 'active' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Database size={18} /> Knowledge Base
                </Link>
              )}
              <button 
                onClick={logout} 
                className="btn" 
                style={{ background: 'transparent', color: 'var(--text-secondary)', padding: '0.5rem' }}
              >
                <LogOut size={18} />
              </button>
            </>
          )}
        </div>
      </nav>
      <main className="app-container animate-fade-in">
        <Outlet />
      </main>
    </>
  );
};

export default Layout;
