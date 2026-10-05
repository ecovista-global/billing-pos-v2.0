import React from 'react';
import { User, Building2, Phone, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Profile() {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <User className="w-5 h-5 text-emerald-600" />
          Employee Profile
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Account details and branch store assignment
        </p>
      </div>

      {}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 text-xs">
        <div className="flex items-center gap-4 border-b pb-5">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-extrabold text-lg border border-emerald-200">
            {user?.full_name ? user.full_name[0] : 'E'}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{user?.full_name}</h2>
            <p className="text-slate-500 font-mono text-[11px] mt-0.5">{user?.employee_id} • @{user?.username}</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {user?.role === 'admin' ? 'Super Administrator' : 'Store Associate'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 font-bold uppercase text-[10px] block">Assigned Store</span>
            <span className="font-bold text-slate-900 text-xs mt-0.5 block">{user?.store_name || 'All Stores (Admin)'}</span>
            <span className="text-slate-500 text-[11px]">{user?.store_code ? `${user.store_code} • ${user.store_city}` : 'Headquarters'}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-400 font-bold uppercase text-[10px] block">Email & Phone</span>
            <span className="font-medium text-slate-800 text-xs mt-0.5 block">{user?.email || 'N/A'}</span>
            <span className="text-slate-500 text-[11px]">{user?.phone || 'N/A'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
