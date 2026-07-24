import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Chat from './pages/Chat';
import Admin from './pages/Admin';
import './index.css';

// A simple wrapper to protect routes
const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { token, role } = useAuth();
  
  if (!token) {
    return <Navigate to="/" />;
  }
  
  if (requireAdmin && role !== 'admin') {
    return <Navigate to="/chat" />;
  }
  
  return children;
};

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Login />} />
            
            <Route 
              path="chat" 
              element={
                <ProtectedRoute>
                  <Chat />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="admin" 
              element={
                <ProtectedRoute requireAdmin={true}>
                  <Admin />
                </ProtectedRoute>
              } 
            />
            
            <Route path="*" element={<Navigate to="/" />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
