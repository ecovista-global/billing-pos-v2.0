import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('ecofone_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verifySession() {
      const token = localStorage.getItem('ecofone_token');
      if (token) {
        try {
          const res = await apiFetch('/auth/me');
          if (res.success && res.user) {
            setUser(res.user);
            localStorage.setItem('ecofone_user', JSON.stringify(res.user));
          }
        } catch (e) {
          localStorage.removeItem('ecofone_token');
          localStorage.removeItem('ecofone_user');
          setUser(null);
        }
      }
      setLoading(false);
    }
    verifySession();
  }, []);

  async function login(username, password) {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    if (res.success && res.token) {
      localStorage.setItem('ecofone_token', res.token);
      localStorage.setItem('ecofone_user', JSON.stringify(res.user));
      setUser(res.user);
      return res.user;
    } else {
      throw new Error(res.message || 'Login failed');
    }
  }

  function logout() {
    localStorage.removeItem('ecofone_token');
    localStorage.removeItem('ecofone_user');
    setUser(null);
    window.location.href = '/login';
  }

  // Permission verification helpers
  function canAccess(moduleKey) {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'super_admin') return true;
    if (!moduleKey) return true;
    if (!user.permissions) return true; // default full access if not explicitly restricted
    const perm = user.permissions[moduleKey];
    if (!perm) return true;
    return perm.view !== false;
  }

  function canEdit(moduleKey) {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'super_admin') return true;
    if (!moduleKey) return true;
    if (!user.permissions) return true;
    const perm = user.permissions[moduleKey];
    if (!perm) return true;
    return perm.edit !== false && perm.view !== false;
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      setUser, 
      login, 
      logout, 
      loading, 
      isAdmin: user?.role === 'admin' || user?.role === 'super_admin',
      canAccess,
      canEdit
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
