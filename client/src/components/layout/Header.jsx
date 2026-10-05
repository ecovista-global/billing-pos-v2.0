import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStoreContext } from '../../context/StoreContext';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  User, 
  LogOut, 
  Bell, 
  ShoppingBag, 
  ShieldCheck, 
  Menu,
  X,
  ExternalLink
} from 'lucide-react';
import { apiFetch } from '../../services/api';

export default function Header({ toggleSidebar, isSidebarOpen }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const { stores, selectedStoreId, setSelectedStoreId, isAllStores } = useStoreContext();

  useEffect(() => {
    async function loadNotifications() {
      try {
        const res = await apiFetch('/settings/notifications');
        if (res.success && res.notifications) {
          setNotifications(res.notifications);
        }
      } catch (e) {
        // Silently fail if not reachable
      }
    }
    loadNotifications();
  }, []);

  const posPath = isAdmin ? '/admin/pos' : '/employee/pos';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
        {}
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleSidebar}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition"
            title="Toggle Sidebar"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="hidden sm:flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              {isAdmin ? (
                <select 
                  className="bg-transparent text-emerald-700 font-bold border-none outline-none text-xs cursor-pointer focus:ring-0 pl-0 pr-6"
                  value={selectedStoreId || ''}
                  onChange={(e) => setSelectedStoreId(e.target.value ? parseInt(e.target.value) : null)}
                >
                  <option value="">All Stores ({stores.length})</option>
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              ) : (
                <span>Store: <strong className="text-slate-900">{user?.store_name || user?.store_code || 'Assigned Store'}</strong></span>
              )}
            </div>
          </div>
        </div>

        {}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(posPath)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition active:scale-95"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Open POS</span>
          </button>

          {}
          <div className="relative">
            <button
              onClick={() => setShowNotif(!showNotif)}
              className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
              )}
            </button>

            {showNotif && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Notifications</span>
                  <span className="text-xs bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded-full">{notifications.length} New</span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-slate-400">No new alerts</div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} className="p-3 hover:bg-slate-50 transition cursor-pointer text-xs">
                        <div className="font-semibold text-slate-800">{n.title}</div>
                        <div className="text-slate-500 text-[11px] mt-0.5">{n.message}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-slate-200"></div>

          {}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs border border-emerald-200 shadow-sm">
              {user?.full_name ? user.full_name[0] : 'U'}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-bold text-slate-800 leading-none">{user?.full_name}</div>
              <div className="text-[10px] text-slate-500 font-medium capitalize mt-0.5 flex items-center gap-1">
                {isAdmin ? (
                  <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                    <ShieldCheck className="w-3 h-3" /> {user?.full_name?.includes('Gaurav') ? 'CEO' : 'Super Admin'}
                  </span>
                ) : (
                  <span>Store Employee</span>
                )}
              </div>
            </div>

            <button
              onClick={logout}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
