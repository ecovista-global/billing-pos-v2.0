import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Building2, Receipt, ShieldCheck, CheckCircle } from 'lucide-react';
import { apiFetch } from '../../services/api';

const DEFAULT_SETTINGS = {
  company_name: 'Ecofone',
  company_tagline: 'Luxury within reach',
  company_address: 'Ecofone Central HQ, Tower 4, BKC, Bandra East, Mumbai, Maharashtra 400051',
  company_phone: '+91 1800 266 3263',
  company_email: 'contact@ecofone.in',
  company_gstin: '27AABCE1234F1Z5',
  invoice_prefix: 'ECO',
  invoice_footer: 'Thank you for choosing Ecofone! Certified Refurbished Premium Devices.',
  invoice_terms: '1. 6 Months Ecofone Certified Warranty included.\n2. Warranty covers manufacturing and hardware defects.\n3. Physical and liquid damages are void from warranty.\n4. Original tax invoice is required for warranty and claims.',
  default_tax_rate: '18.0'
};

const getCachedSettings = () => {
  try {
    const saved = localStorage.getItem('ecofone_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {}
  return DEFAULT_SETTINGS;
};

export default function Settings() {
  const [settings, setSettings] = useState(getCachedSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await apiFetch('/settings');
        if (res.success && res.settings && Object.keys(res.settings).length > 0) {
          setSettings(s => {
            const merged = { ...s, ...res.settings };
            try {
              localStorage.setItem('ecofone_settings', JSON.stringify(merged));
            } catch (err) {}
            return merged;
          });
        } else {
          // If server settings are uninitialized/empty, push cached settings to server
          const current = getCachedSettings();
          apiFetch('/settings', {
            method: 'PUT',
            body: JSON.stringify({ settings: current })
          }).catch(() => {});
        }
      } catch (e) {
        console.error('Could not load remote settings, using local cache:', e);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // 1. Persist immediately to browser local storage so refresh never resets it
      try {
        localStorage.setItem('ecofone_settings', JSON.stringify(settings));
      } catch (err) {}

      // 2. Persist to backend server
      const res = await apiFetch('/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings })
      });
      if (res.success) {
        alert('System settings updated successfully!');
      } else {
        alert(res.message || 'Settings saved locally.');
      }
    } catch (err) {
      alert('Settings saved locally: ' + (err.message || 'Updated in browser storage.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-emerald-600" />
            Company & System Settings
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure Ecofone branding, GST tax numbers, invoice legal disclaimers, and warranty terms
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5 text-xs">
        {}
        <div className="space-y-3">
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 pb-2 border-b">
            <Building2 className="w-4 h-4 text-emerald-600" />
            Company Identification & Branding
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Company Trade Name *</label>
              <input
                type="text"
                required
                value={settings.company_name}
                onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border rounded-lg font-bold"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Brand Tagline</label>
              <input
                type="text"
                value={settings.company_tagline}
                onChange={(e) => setSettings({ ...settings, company_tagline: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Corporate HQ Registered Address</label>
            <input
              type="text"
              value={settings.company_address}
              onChange={(e) => setSettings({ ...settings, company_address: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Support Phone</label>
              <input
                type="text"
                value={settings.company_phone}
                onChange={(e) => setSettings({ ...settings, company_phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Support Email</label>
              <input
                type="email"
                value={settings.company_email}
                onChange={(e) => setSettings({ ...settings, company_email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Corporate GSTIN *</label>
              <input
                type="text"
                required
                value={settings.company_gstin}
                onChange={(e) => setSettings({ ...settings, company_gstin: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border rounded-lg font-mono font-bold"
              />
            </div>
          </div>
        </div>

        {}
        <div className="space-y-3 pt-4">
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 pb-2 border-b">
            <Receipt className="w-4 h-4 text-emerald-600" />
            Invoice Numbering & Tax Rules
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Invoice Number Prefix</label>
              <input
                type="text"
                value={settings.invoice_prefix}
                onChange={(e) => setSettings({ ...settings, invoice_prefix: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border rounded-lg font-mono font-bold"
              />
              <p className="text-[10px] text-slate-400 mt-1">Generated invoices will read {settings.invoice_prefix}-2026-XXXXXX</p>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Default GST Rate (%)</label>
              <input
                type="number"
                value={settings.default_tax_rate}
                onChange={(e) => setSettings({ ...settings, default_tax_rate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border rounded-lg font-bold"
              />
              <p className="text-[10px] text-slate-400 mt-1">Applied on Margin / Difference (Selling Price - Purchase Price)</p>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Invoice Footer Greeting</label>
            <input
              type="text"
              value={settings.invoice_footer}
              onChange={(e) => setSettings({ ...settings, invoice_footer: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Invoice Terms & Certified Warranty Disclaimers</label>
            <textarea
              rows={4}
              value={settings.invoice_terms}
              onChange={(e) => setSettings({ ...settings, invoice_terms: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border rounded-lg font-mono text-[11px]"
            />
          </div>
        </div>

        <div className="pt-4 border-t flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save System Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
