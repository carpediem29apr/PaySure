import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

export function AuthProvider({ children }) {
  const [merchant, setMerchant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('paysure_token'));

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchMerchant();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchMerchant = async () => {
    try {
      const res = await axios.get(`${API_URL}/auth/me`);
      setMerchant(res.data);
    } catch (err) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await axios.post(`${API_URL}/auth/login`, { email, password });
    const { access_token, merchant: merchantData } = res.data;
    localStorage.setItem('paysure_token', access_token);
    setToken(access_token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    setMerchant(merchantData);
    return merchantData;
  };

  const register = async (data) => {
    const res = await axios.post(`${API_URL}/auth/register`, data);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('paysure_token');
    setToken(null);
    setMerchant(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ merchant, login, register, logout, loading, token }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
