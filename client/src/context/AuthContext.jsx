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
      return { success: true, user: res.user };
    } else if (res.success && res.require2fa) {
      return { success: true, require2fa: true, tempToken: res.tempToken, message: res.message, qrCodeUrl: res.qrCodeUrl, setupRequired: res.setupRequired, tempSecret: res.tempSecret };
    } else {
      throw new Error(res.message || 'Login failed');
    }
  }

  async function verify2fa(tempToken, code, tempSecret = null) {
    const res = await apiFetch('/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ tempToken, code, tempSecret })
    });

    if (res.success && res.token) {
      localStorage.setItem('ecofone_token', res.token);
      localStorage.setItem('ecofone_user', JSON.stringify(res.user));
      setUser(res.user);
      return { success: true, user: res.user };
    } else {
      throw new Error(res.message || '2FA Verification failed');
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
      verify2fa,
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
