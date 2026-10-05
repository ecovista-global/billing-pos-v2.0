import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Lock, User, ArrowRight, Eye, EyeOff, ShieldAlert } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(username, password);
      if (user.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/employee/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      
      {}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full relative z-10">
        
        {}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white rounded-3xl p-2 mx-auto shadow-2xl flex items-center justify-center border-2 border-emerald-500/20 mb-3">
            <img 
              src="/logo.png" 
              alt="Ecofone" 
              className="w-full h-full object-contain"
              onError={(e) => { e.target.src = 'https://placehold.co/120x120?text=EcoFone'; }}
            />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">EcoFone</h1>
          <p className="text-sm font-semibold text-amber-400 mt-0.5">Luxury within reach</p>
          <p className="text-xs text-slate-400 mt-1">Multi-Store POS & Business Management System</p>
        </div>

        {}
        <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 sm:p-8 shadow-2xl border border-white/20">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">Sign in to your account</h2>
            <p className="text-xs text-slate-500 mt-0.5">Enter your employee ID or credentials to continue</p>
          </div>

          {error && (
            <div className={`mb-4 p-3.5 rounded-xl border flex items-start gap-2.5 text-xs font-medium ${
              error.toLowerCase().includes('disabled') || error.toLowerCase().includes('locked')
                ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-xs'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}>
              <ShieldAlert className={`w-4 h-4 shrink-0 mt-0.5 ${
                error.toLowerCase().includes('disabled') || error.toLowerCase().includes('locked')
                  ? 'text-rose-600'
                  : 'text-amber-600'
              }`} />
              <div className="leading-relaxed">
                {error}
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Username / Employee ID
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username or ID"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition"
                  title={showPassword ? "Hide password" : "View password 👁️"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-emerald-700" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 text-white text-xs font-bold tracking-wide shadow-md hover:shadow-lg transition active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

        </div>

        {}
        <p className="text-center text-xs text-slate-500 mt-6">
          Ecofone Retail Operations • Centralized Multi-Store POS System
        </p>

      </div>
    </div>
  );
}
