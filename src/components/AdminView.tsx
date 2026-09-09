import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck, 
  ListFilter, 
  ShieldAlert, 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  CheckCircle, 
  AlertCircle,
  KeyRound,
  UserPlus
} from 'lucide-react';
import { User, DropdownOptions, Team } from '../types.ts';
import { apiRequest } from '../lib/api.ts';

interface AdminViewProps {
  currentUser: User;
  onSudoLogin: (targetUserId: number) => void;
  onDropdownsUpdated: () => void;
  dropdowns: DropdownOptions;
}

export const AdminView: React.FC<AdminViewProps> = ({
  currentUser,
  onSudoLogin,
  onDropdownsUpdated,
  dropdowns,
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'sudo' | 'dropdowns' | 'teams'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // User form modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [userSaving, setUserSaving] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  // Dropdown option form
  const [dropdownCategory, setDropdownCategory] = useState<'business_unit' | 'oem' | 'distributor'>('business_unit');
  const [newOptionName, setNewOptionName] = useState('');
  const [addingOption, setAddingOption] = useState(false);

  // Team create form
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamLeadId, setTeamLeadId] = useState<number | ''>('');
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);

  const fetchUsersAndTeams = async () => {
    setLoading(true);
    try {
      const [usersData, teamsData] = await Promise.all([
        apiRequest('/api/users'),
        apiRequest('/api/users/teams'),
      ]);
      setUsers(usersData);
      setTeams(teamsData);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndTeams();
  }, []);

  const handleOpenCreateUser = () => {
    setEditingUser({
      name: '',
      username: '',
      email: '',
      password: '',
      role: 'Finance',
      access_level: 'User',
      status: 'Active',
      report_to_id: null,
    });
    setUserError(null);
    setShowUserModal(true);
  };

  const handleOpenEditUser = (u: User) => {
    setEditingUser({
      ...u,
      password: '', // leave empty to keep unchanged
    });
    setUserError(null);
    setShowUserModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserSaving(true);
    setUserError(null);
    try {
      if (editingUser.id) {
        await apiRequest(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify(editingUser),
        });
      } else {
        await apiRequest('/api/users', {
          method: 'POST',
          body: JSON.stringify(editingUser),
        });
      }
      setShowUserModal(false);
      fetchUsersAndTeams();
    } catch (err: any) {
      setUserError(err.message || 'Failed to save user');
    } finally {
      setUserSaving(false);
    }
  };

  const handleAddDropdownOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOptionName.trim()) return;
    setAddingOption(true);
    try {
      await apiRequest('/api/config/dropdowns', {
        method: 'POST',
        body: JSON.stringify({ category: dropdownCategory, name: newOptionName.trim() }),
      });
      setNewOptionName('');
      onDropdownsUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to add option');
    } finally {
      setAddingOption(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    try {
      await apiRequest('/api/users/teams', {
        method: 'POST',
        body: JSON.stringify({
          name: teamName.trim(),
          lead_id: teamLeadId || null,
          member_ids: selectedMembers,
        }),
      });
      setShowTeamModal(false);
      setTeamName('');
      setTeamLeadId('');
      setSelectedMembers([]);
      fetchUsersAndTeams();
    } catch (err: any) {
      alert(err.message || 'Failed to create team');
    }
  };

  return (
    <div id="admin-view-container" className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">System Administration Tools</h1>
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold">
              Admin Only
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            User directory, Sudo troubleshoot mode, dropdown configurations, and organizational teams.
          </p>
        </div>

        {activeTab === 'users' && (
          <button
            id="btn-add-user"
            onClick={handleOpenCreateUser}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition cursor-pointer self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create User</span>
          </button>
        )}

        {activeTab === 'teams' && (
          <button
            onClick={() => setShowTeamModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create Team</span>
          </button>
        )}
      </div>

      {/* Tabs Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-1 flex gap-2 shadow-xs">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'users' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Management ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('sudo')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'sudo' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>'Login As' (Sudo) Mode</span>
        </button>

        <button
          onClick={() => setActiveTab('dropdowns')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'dropdowns' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ListFilter className="w-4 h-4" />
          <span>Dropdown Editor</span>
        </button>

        <button
          onClick={() => setActiveTab('teams')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'teams' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Teams ({teams.length})</span>
        </button>
      </div>

      {/* TAB 1: USERS */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Name & Username</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role (Department)</th>
                <th className="py-3 px-4">Access Level</th>
                <th className="py-3 px-4">Reports To</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">Loading users...</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {u.name}
                      <span className="block text-[10px] text-slate-400 font-normal">@{u.username}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold text-[11px]">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">{u.access_level}</td>
                    <td className="py-3 px-4 text-slate-500">{u.report_to_name || 'None'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.status === 'Active' ? 'bg-emerald-100 text-emerald-800' :
                        u.status === 'Suspended' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditUser(u)}
                          className="px-2 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded font-semibold text-xs transition cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onSudoLogin(u.id)}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded font-semibold text-xs transition cursor-pointer"
                          title="Login as this user (Sudo troubleshooting)"
                        >
                          Sudo
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: SUDO MODE */}
      {activeTab === 'sudo' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <UserCheck className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Administrator 'Login As' (Sudo) Mode
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Simulate any user's view, inspect pending quotes assigned to their department stage, or troubleshoot approval bottlenecks.
                All Sudo actions are logged to the security audit trail.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {users.map((u) => (
              <div
                key={u.id}
                className="p-4 border border-slate-200 rounded-xl hover:border-blue-400 transition flex items-center justify-between"
              >
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{u.name}</h4>
                  <p className="text-[11px] text-slate-500">@{u.username} • {u.role}</p>
                  <span className="text-[10px] text-blue-600 font-semibold">{u.access_level}</span>
                </div>

                <button
                  onClick={() => onSudoLogin(u.id)}
                  disabled={u.id === currentUser.id}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-30"
                >
                  {u.id === currentUser.id ? 'You' : 'Switch To'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: DROPDOWN EDITOR */}
      {activeTab === 'dropdowns' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Manage Master Dropdown Lists</h3>
            <p className="text-xs text-slate-500">
              Configure options available to sales reps when drafting quotations.
            </p>
          </div>

          {/* Add Option Form */}
          <form onSubmit={handleAddDropdownOption} className="flex gap-3 max-w-xl">
            <select
              value={dropdownCategory}
              onChange={(e) => setDropdownCategory(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-medium"
            >
              <option value="business_unit">Business Unit</option>
              <option value="oem">OEM Partner</option>
              <option value="distributor">Distributor</option>
            </select>

            <input
              type="text"
              required
              value={newOptionName}
              onChange={(e) => setNewOptionName(e.target.value)}
              placeholder="e.g. Fortinet, Palo Alto, Redington..."
              className="flex-1 text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500"
            />

            <button
              type="submit"
              disabled={addingOption}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
            >
              {addingOption ? 'Adding...' : 'Add Option'}
            </button>
          </form>

          {/* Display Current Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
            {/* Business Units */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Business Units ({dropdowns.business_unit.length})
              </h4>
              <div className="space-y-1.5">
                {dropdowns.business_unit.map((bu, idx) => (
                  <div key={idx} className="text-xs bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span>{bu}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* OEMs */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                OEM Partners ({dropdowns.oem.length})
              </h4>
              <div className="space-y-1.5">
                {dropdowns.oem.map((oem, idx) => (
                  <div key={idx} className="text-xs bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span>{oem}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Distributors */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Distributors ({dropdowns.distributor.length})
              </h4>
              <div className="space-y-1.5">
                {dropdowns.distributor.map((dist, idx) => (
                  <div key={idx} className="text-xs bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span>{dist}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TEAMS */}
      {activeTab === 'teams' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Organizational Teams</h3>
            <span className="text-xs text-slate-500">{teams.length} teams configured</span>
          </div>

          <div className="divide-y divide-slate-100">
            {teams.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">No teams configured yet</div>
            ) : (
              teams.map((t) => (
                <div key={t.id} className="p-4 hover:bg-slate-50 transition">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{t.name}</h4>
                      <p className="text-xs text-slate-500">Team Lead: <strong>{t.lead_name || 'Unassigned'}</strong></p>
                    </div>
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">
                      {t.members?.length || 0} Members
                    </span>
                  </div>

                  {t.members && t.members.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {t.members.map((m) => (
                        <span key={m.user_id} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px]">
                          {m.name} ({m.role})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* User Add/Edit Modal */}
      {showUserModal && editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {editingUser.id ? `Edit User: ${editingUser.name}` : 'Create New User'}
              </h3>
              <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-slate-600 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              {userError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs border border-red-200">
                  {userError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editingUser.name || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingUser.id}
                    value={editingUser.username || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={editingUser.email || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Password {editingUser.id ? '(Leave blank to retain current)' : '*'}
                  </label>
                  <input
                    type="password"
                    required={!editingUser.id}
                    value={editingUser.password || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Role (Department) *</label>
                  <select
                    value={editingUser.role || 'Finance'}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                  >
                    <option value="Sales">Sales</option>
                    <option value="Finance">Finance</option>
                    <option value="Presales">Presales</option>
                    <option value="Management">Management</option>
                    <option value="Operations">Operations</option>
                    <option value="Logistics">Logistics</option>
                    <option value="Administration">Administration</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Access Level *</label>
                  <select
                    value={editingUser.access_level || 'User'}
                    onChange={(e) => setEditingUser({ ...editingUser, access_level: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                  >
                    <option value="User">User</option>
                    <option value="TeamLead">TeamLead</option>
                    <option value="Management">Management</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={editingUser.status || 'Active'}
                    onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                  >
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Hold">Hold</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Reports To (Manager)</label>
                  <select
                    value={editingUser.report_to_id || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, report_to_id: e.target.value ? parseInt(e.target.value, 10) : null })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                  >
                    <option value="">None (Top level)</option>
                    {users.filter(u => u.id !== editingUser.id).map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={userSaving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{userSaving ? 'Saving...' : 'Save User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Team Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Create New Team</h3>
              <button onClick={() => setShowTeamModal(false)} className="text-slate-400 hover:text-slate-600 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Team Name *</label>
                <input
                  type="text"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. West Region Enterprise Sales"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Team Lead</label>
                <select
                  value={teamLeadId}
                  onChange={(e) => setTeamLeadId(e.target.value ? parseInt(e.target.value, 10) : '')}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                >
                  <option value="">Select a Lead</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Members</label>
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                  {users.map(u => (
                    <label key={u.id} className="flex items-center gap-2 text-xs p-1 hover:bg-slate-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(u.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedMembers([...selectedMembers, u.id]);
                          else setSelectedMembers(selectedMembers.filter(id => id !== u.id));
                        }}
                      />
                      <span>{u.name} ({u.role})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowTeamModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
