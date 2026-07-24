import React, { createContext, useState, useContext, useEffect } from 'react';
import { login as apiLogin } from '../api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [role, setRole] = useState(localStorage.getItem('role') || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If token changes, update localStorage
    if (token) {
      localStorage.setItem('token', token);
      localStorage.setItem('role', role);
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
    }
  }, [token, role]);

  const login = async (username, password) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiLogin(username, password);
      setToken(data.access_token);
      setRole(data.role);
      return true;
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ token, role, login, logout, isLoading, error }}>
      {children}
    </AuthContext.Provider>
  );
};
