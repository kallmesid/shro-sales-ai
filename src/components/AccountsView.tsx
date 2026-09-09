import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  User as UserIcon, 
  Edit2, 
  Trash2, 
  X, 
  Save, 
  FileText 
} from 'lucide-react';
import { Account, AccountContact } from '../types.ts';
import { apiRequest } from '../lib/api.ts';

interface AccountsViewProps {
  onSelectCostSheet: (id: number) => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({ onSelectCostSheet }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Partial<Account> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/api/accounts');
      setAccounts(data);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleOpenCreate = () => {
    setEditingAccount({
      name: '',
      industry: 'IT & ITES',
      phone: '',
      email: '',
      comments: '',
      contacts: [
        { name: '', designation: 'Procurement Manager', phone: '', email: '' }
      ]
    });
    setError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (acc: Account) => {
    setEditingAccount({
      ...acc,
      contacts: acc.contacts && acc.contacts.length > 0 ? acc.contacts : [
        { name: '', designation: '', phone: '', email: '' }
      ]
    });
    setError(null);
    setShowModal(true);
  };

  const handleAddContact = () => {
    if (!editingAccount) return;
    setEditingAccount({
      ...editingAccount,
      contacts: [
        ...(editingAccount.contacts || []),
        { name: '', designation: '', phone: '', email: '' }
      ]
    });
  };

  const handleRemoveContact = (index: number) => {
    if (!editingAccount?.contacts) return;
    const updated = [...editingAccount.contacts];
    updated.splice(index, 1);
    setEditingAccount({ ...editingAccount, contacts: updated });
  };

  const handleContactChange = (index: number, field: keyof AccountContact, val: string) => {
    if (!editingAccount?.contacts) return;
    const updated = [...editingAccount.contacts];
    updated[index] = { ...updated[index], [field]: val };
    setEditingAccount({ ...editingAccount, contacts: updated });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount?.name?.trim()) {
      setError('Account name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingAccount.id) {
        await apiRequest(`/api/accounts/${editingAccount.id}`, {
          method: 'PUT',
          body: JSON.stringify(editingAccount),
        });
      } else {
        await apiRequest('/api/accounts', {
          method: 'POST',
          body: JSON.stringify(editingAccount),
        });
      }
      setShowModal(false);
      fetchAccounts();
    } catch (err: any) {
      setError(err.message || 'Failed to save account');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to remove this customer account?')) return;
    try {
      await apiRequest(`/api/accounts/${id}`, { method: 'DELETE' });
      setAccounts(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete account');
    }
  };

  const filtered = accounts.filter(a => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      a.name?.toLowerCase().includes(q) ||
      a.industry?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div id="accounts-view-container" className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Customer Accounts & Contacts</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Enterprise clients, multi-contact stakeholders, and quotation associations.
          </p>
        </div>

        <button
          id="btn-add-account"
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-600/20 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Account</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search accounts by name, industry, or email..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Accounts Grid */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-500">Loading accounts...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
          No customer accounts found. Click "Add Account" to create your first client.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((acc) => (
            <div
              key={acc.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{acc.name}</h3>
                      <span className="text-[11px] text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded">
                        {acc.industry || 'General Industry'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(acc)}
                      className="p-1 text-slate-400 hover:text-blue-600 rounded transition cursor-pointer"
                      title="Edit Account"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(acc.id)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
                      title="Delete Account"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Account Details */}
                <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                  {acc.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{acc.phone}</span>
                    </div>
                  )}
                  {acc.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{acc.email}</span>
                    </div>
                  )}
                  {acc.comments && (
                    <p className="text-[11px] text-slate-500 italic mt-2 line-clamp-2">
                      "{acc.comments}"
                    </p>
                  )}
                </div>

                {/* Stakeholder Contacts */}
                {acc.contacts && acc.contacts.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Key Contacts ({acc.contacts.length})
                    </p>
                    <div className="space-y-1.5">
                      {acc.contacts.map((c, i) => (
                        <div key={i} className="text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <p className="font-semibold text-slate-800">{c.name}</p>
                          <p className="text-[10px] text-slate-500">{c.designation || 'Contact'} • {c.phone || c.email || 'No phone'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Account Add/Edit Modal */}
      {showModal && editingAccount && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {editingAccount.id ? 'Edit Customer Account' : 'New Customer Account'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs border border-red-200">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company / Account Name *</label>
                  <input
                    type="text"
                    required
                    value={editingAccount.name || ''}
                    onChange={(e) => setEditingAccount({ ...editingAccount, name: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Tata Consultancy Services"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Industry</label>
                  <input
                    type="text"
                    value={editingAccount.industry || ''}
                    onChange={(e) => setEditingAccount({ ...editingAccount, industry: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. IT & Software"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Main Phone</label>
                  <input
                    type="text"
                    value={editingAccount.phone || ''}
                    onChange={(e) => setEditingAccount({ ...editingAccount, phone: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="+91 22 6777 0000"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Billing / Official Email</label>
                  <input
                    type="email"
                    value={editingAccount.email || ''}
                    onChange={(e) => setEditingAccount({ ...editingAccount, email: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="procurement@client.com"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Internal Notes</label>
                  <textarea
                    rows={2}
                    value={editingAccount.comments || ''}
                    onChange={(e) => setEditingAccount({ ...editingAccount, comments: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Special payment terms, account history, etc."
                  />
                </div>
              </div>

              {/* Contacts Editor */}
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Stakeholder Contacts</span>
                  <button
                    type="button"
                    onClick={handleAddContact}
                    className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Contact</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {editingAccount.contacts?.map((c, i) => (
                    <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-lg relative space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Contact Name"
                          value={c.name}
                          onChange={(e) => handleContactChange(i, 'name', e.target.value)}
                          className="text-xs p-1.5 bg-white border border-slate-300 rounded"
                        />
                        <input
                          type="text"
                          placeholder="Designation / Role"
                          value={c.designation || ''}
                          onChange={(e) => handleContactChange(i, 'designation', e.target.value)}
                          className="text-xs p-1.5 bg-white border border-slate-300 rounded"
                        />
                        <input
                          type="text"
                          placeholder="Phone"
                          value={c.phone || ''}
                          onChange={(e) => handleContactChange(i, 'phone', e.target.value)}
                          className="text-xs p-1.5 bg-white border border-slate-300 rounded"
                        />
                        <input
                          type="email"
                          placeholder="Email"
                          value={c.email || ''}
                          onChange={(e) => handleContactChange(i, 'email', e.target.value)}
                          className="text-xs p-1.5 bg-white border border-slate-300 rounded"
                        />
                      </div>
                      {editingAccount.contacts!.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveContact(i)}
                          className="text-[10px] text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove Contact</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
