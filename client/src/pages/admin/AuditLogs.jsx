import React, { useState, useEffect } from 'react';
import { History, Search, ShieldCheck, User, Clock, Filter } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { formatDateTime } from '../../utils/formatters';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let q = '/settings/audit-logs?limit=100';
      if (actionFilter) q += `&action=${encodeURIComponent(actionFilter)}`;
      const res = await apiFetch(q);
      if (res.success) setLogs(res.logs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  return (
    <div className="space-y-5">
      {}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-emerald-600" />
            System Audit Trail & Security Logs
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable log of all user logins, sales, voids, inventory updates, and transfers (Section 27)
          </p>
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
        >
          <option value="">All Audit Actions</option>
          <option value="LOGIN">LOGIN</option>
          <option value="COMPLETE_SALE">COMPLETE_SALE</option>
          <option value="VOID_INVOICE">VOID_INVOICE</option>
          <option value="ADD_INVENTORY">ADD_INVENTORY</option>
          <option value="INITIATE_TRANSFER">INITIATE_TRANSFER</option>
          <option value="RECEIVE_TRANSFER">RECEIVE_TRANSFER</option>
          <option value="PROCESS_RETURN">PROCESS_RETURN</option>
          <option value="UPDATE_SETTINGS">UPDATE_SETTINGS</option>
        </select>
      </div>

      {}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">No audit logs found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-3">User</th>
                  <th className="py-3 px-3">Action</th>
                  <th className="py-3 px-3">Entity Type</th>
                  <th className="py-3 px-3">Audit Details</th>
                  <th className="py-3 px-4">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {formatDateTime(l.created_at)}
                    </td>

                    <td className="py-3 px-3 font-bold text-slate-900">
                      {l.username || 'System'}
                    </td>

                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-slate-100 text-slate-800 border">
                        {l.action}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-slate-500 uppercase text-[10px] font-bold">
                      {l.entity_type || '-'}
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600 max-w-md truncate">
                      {l.details}
                    </td>

                    <td className="py-3 px-4 font-mono text-[10px] text-slate-400">
                      {l.ip_address || '127.0.0.1'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
