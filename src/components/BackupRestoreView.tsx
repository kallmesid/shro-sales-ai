import React, { useState, useRef } from 'react';
import { 
  Archive, 
  Download, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  FileArchive, 
  RefreshCw, 
  Database, 
  FolderArchive, 
  HardDrive,
  FileText,
  ShieldAlert,
  Info,
  Layers,
  Users,
  Building2,
  Check
} from 'lucide-react';
import { apiRequest } from '../lib/api.ts';

interface InspectionData {
  valid: boolean;
  metadata?: {
    format_version?: string;
    exported_at?: string;
    exported_by?: {
      name?: string;
      username?: string;
      email?: string;
    };
    system?: string;
    stats?: Record<string, any>;
  };
  tableCounts: Record<string, number>;
  filesCount: number;
  filesTotalBytes: number;
  filesFormatted: string;
  sampleFiles: { name: string; size: number }[];
}

interface RestoreStats {
  cost_sheets?: number;
  line_items?: number;
  accounts?: number;
  users?: number;
  teams?: number;
  team_members?: number;
  dropdown_options?: number;
  approval_logs?: number;
  uploaded_files?: number;
  notifications?: number;
  physical_files_extracted?: number;
}

export const BackupRestoreView: React.FC = () => {
  // Export State
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Import / Inspect State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [inspectionData, setInspectionData] = useState<InspectionData | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  // Restore State
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');
  const [confirmSafety, setConfirmSafety] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<{ message: string; mode: string; stats: RestoreStats } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle Export Full Backup (.zip)
  const handleExportBackup = async () => {
    setExporting(true);
    setExportError(null);
    setExportSuccess(null);
    try {
      const blob = await apiRequest('/api/backup/export');
      
      // Trigger download in browser
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.download = `shro-portal-backup-${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setExportSuccess(`Backup archive (${(blob.size / (1024 * 1024)).toFixed(2)} MB) downloaded successfully.`);
    } catch (err: any) {
      setExportError(err.message || 'Failed to generate backup archive');
    } finally {
      setExporting(false);
    }
  };

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setInspectError('Please select a valid .zip backup archive.');
        return;
      }
      setSelectedFile(file);
      setInspectionData(null);
      setInspectError(null);
      setRestoreResult(null);
      setRestoreError(null);
      setConfirmSafety(false);
    }
  };

  // Inspect Selected Archive
  const handleInspectFile = async () => {
    if (!selectedFile) return;
    setInspecting(true);
    setInspectError(null);
    setInspectionData(null);
    setRestoreResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const data = await apiRequest('/api/backup/inspect', {
        method: 'POST',
        body: formData
      });
      setInspectionData(data);
    } catch (err: any) {
      setInspectError(err.message || 'Failed to inspect backup file');
    } finally {
      setInspecting(false);
    }
  };

  // Execute Restore
  const handleExecuteRestore = async () => {
    if (!selectedFile) return;
    if (!confirmSafety) {
      alert('Please confirm that you understand this restore operation.');
      return;
    }

    if (restoreMode === 'replace') {
      const confirmed = window.confirm(
        'WARNING: Clean Replacement will replace current database records and uploads with the contents of this backup. Are you sure you want to proceed?'
      );
      if (!confirmed) return;
    }

    setRestoring(true);
    setRestoreError(null);
    setRestoreResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('mode', restoreMode);

    try {
      const result = await apiRequest('/api/backup/restore', {
        method: 'POST',
        body: formData
      });
      setRestoreResult(result);
    } catch (err: any) {
      setRestoreError(err.message || 'Failed to restore backup');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-xl shadow-sm border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <Archive className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-bold tracking-tight">Full System Backup & Disaster Recovery</h2>
            </div>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              Export and import complete snapshots of the entire application as a single self-contained <code className="text-blue-300 bg-slate-800 px-1.5 py-0.5 rounded text-xs">.zip</code> archive.
              Includes all PostgreSQL database tables, deal commercials, approval logs, users, master dropdown configs, and all physical PDF quotes and BOM attachments.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="btn-export-backup-hero"
              onClick={handleExportBackup}
              disabled={exporting}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg shadow transition disabled:opacity-50"
            >
              {exporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating Archive...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export Full Backup (.zip)
                </>
              )}
            </button>
          </div>
        </div>

        {exportSuccess && (
          <div className="mt-4 p-3 bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{exportSuccess}</span>
          </div>
        )}
        {exportError && (
          <div className="mt-4 p-3 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{exportError}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Card 1: System Export Details */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Export Backup Package</h3>
                <p className="text-xs text-slate-500">Download complete system state into an offline portable zip</p>
              </div>
            </div>
            <span className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full border border-emerald-200">
              Disaster-Ready
            </span>
          </div>

          <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
            <p>
              The exported archive contains everything required to recover or migrate the system to any other server or container instance:
            </p>
            <div className="space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-200/80">
              <div className="flex items-start gap-2.5">
                <Database className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800">database-backup.json:</strong> Full dump of all 10 PostgreSQL tables (Users, Accounts, Cost Sheets, Line Items, 6-Stage Approval Logs, Dropdown Options, Notifications).
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <FolderArchive className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800">uploads/ Directory Tree:</strong> All physical files structured cost-sheet-wise (`uploads/SHRO_.../`), including PDF BOMs, vendor quotations, and generated plaintext <code className="bg-white px-1 py-0.5 rounded border text-[11px]">deal-info.txt</code> manifests.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <FileText className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800">backup-metadata.json:</strong> Timestamp, origin admin user, total record counts, and integrity checksums for automated scripts.
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              id="btn-export-backup-card"
              onClick={handleExportBackup}
              disabled={exporting}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold shadow transition disabled:opacity-50"
            >
              {exporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating & Packaging Archive...
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4" />
                  Download Complete System Backup (.zip)
                </>
              )}
            </button>
          </div>
        </div>

        {/* Card 2: Restore from Backup */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Import & Restore Backup</h3>
                <p className="text-xs text-slate-500">Restore database records, configs, and attachments from a .zip</p>
              </div>
            </div>
            <span className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 rounded-full border border-amber-200">
              Admin Only
            </span>
          </div>

          {/* File Picker */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700">
              Select Backup Archive (.zip)
            </label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-400 bg-slate-50/60 rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
            >
              <FileArchive className="w-8 h-8 text-blue-500" />
              {selectedFile ? (
                <div className="text-xs">
                  <p className="font-semibold text-slate-800">{selectedFile.name}</p>
                  <p className="text-slate-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  <p className="font-semibold text-blue-600">Click to browse or drag & drop</p>
                  <p>Accepts .zip backup archives generated by SHRO Portal</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {selectedFile && !inspectionData && (
            <div className="flex justify-end">
              <button
                id="btn-inspect-backup"
                type="button"
                onClick={handleInspectFile}
                disabled={inspecting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {inspecting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Inspecting Archive...
                  </>
                ) : (
                  <>
                    <Layers className="w-3.5 h-3.5" />
                    Inspect & Verify Archive Contents
                  </>
                )}
              </button>
            </div>
          )}

          {inspectError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{inspectError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Inspection Results & Execution Modal/Card */}
      {inspectionData && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Archive Inspection Summary</h3>
                <p className="text-xs text-slate-500">
                  Exported on {inspectionData.metadata?.exported_at ? new Date(inspectionData.metadata.exported_at).toLocaleString() : 'N/A'}
                  {inspectionData.metadata?.exported_by?.name ? ` by ${inspectionData.metadata.exported_by.name}` : ''}
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-full self-start sm:self-auto">
              Archive Verified & Ready
            </span>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Cost Sheets</span>
              <span className="text-lg font-bold text-slate-900">{inspectionData.tableCounts.cost_sheets || 0}</span>
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Line Items</span>
              <span className="text-lg font-bold text-slate-900">{inspectionData.tableCounts.line_items || 0}</span>
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Customer Accounts</span>
              <span className="text-lg font-bold text-slate-900">{inspectionData.tableCounts.accounts || 0}</span>
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">Physical Attachments</span>
              <span className="text-lg font-bold text-slate-900">
                {inspectionData.filesCount} ({inspectionData.filesFormatted})
              </span>
            </div>
          </div>

          {/* Database Tables Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Database Entities Detected</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
              <div className="px-2.5 py-1.5 bg-slate-100 rounded text-slate-700 flex justify-between">
                <span>Users:</span>
                <strong className="text-slate-900">{inspectionData.tableCounts.users || 0}</strong>
              </div>
              <div className="px-2.5 py-1.5 bg-slate-100 rounded text-slate-700 flex justify-between">
                <span>Teams:</span>
                <strong className="text-slate-900">{inspectionData.tableCounts.teams || 0}</strong>
              </div>
              <div className="px-2.5 py-1.5 bg-slate-100 rounded text-slate-700 flex justify-between">
                <span>Approval Logs:</span>
                <strong className="text-slate-900">{inspectionData.tableCounts.approval_logs || 0}</strong>
              </div>
              <div className="px-2.5 py-1.5 bg-slate-100 rounded text-slate-700 flex justify-between">
                <span>Master Dropdowns:</span>
                <strong className="text-slate-900">{inspectionData.tableCounts.dropdown_options || 0}</strong>
              </div>
              <div className="px-2.5 py-1.5 bg-slate-100 rounded text-slate-700 flex justify-between">
                <span>File Records:</span>
                <strong className="text-slate-900">{inspectionData.tableCounts.uploaded_files || 0}</strong>
              </div>
            </div>
          </div>

          {/* Restore Options Form */}
          <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Restoration Mode</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label 
                className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${
                  restoreMode === 'replace' 
                    ? 'border-blue-600 bg-blue-50/50' 
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">Clean Replace (Recommended for Disaster Recovery)</span>
                    <input
                      type="radio"
                      name="restoreMode"
                      value="replace"
                      checked={restoreMode === 'replace'}
                      onChange={() => setRestoreMode('replace')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Wipes the existing database and replaces all cost sheets, accounts, users, and uploads folder with this backup snapshot.
                    Guarantees 100% exact state match.
                  </p>
                </div>
              </label>

              <label 
                className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${
                  restoreMode === 'merge' 
                    ? 'border-blue-600 bg-blue-50/50' 
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">Safe Merge / Append</span>
                    <input
                      type="radio"
                      name="restoreMode"
                      value="merge"
                      checked={restoreMode === 'merge'}
                      onChange={() => setRestoreMode('merge')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Retains current data and only inserts missing cost sheets, accounts, and users. Existing IDs are preserved.
                  </p>
                </div>
              </label>
            </div>

            {/* Safety Confirmation Checkbox */}
            <div className="pt-2 flex items-start gap-3">
              <input
                id="chk-confirm-restore"
                type="checkbox"
                checked={confirmSafety}
                onChange={(e) => setConfirmSafety(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <label htmlFor="chk-confirm-restore" className="text-xs text-slate-700 cursor-pointer">
                I understand that this action will execute a system-level database and file restoration.
                {restoreMode === 'replace' && (
                  <span className="block text-red-600 font-semibold mt-0.5">
                    Notice: Clean Replacement will overwrite the current database and file uploads with the backup state.
                  </span>
                )}
              </label>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setInspectionData(null);
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                id="btn-execute-restore"
                type="button"
                onClick={handleExecuteRestore}
                disabled={restoring || !confirmSafety}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {restoring ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Restoring Database & Files...
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4" />
                    Execute System Restore
                  </>
                )}
              </button>
            </div>
          </div>

          {restoreError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{restoreError}</span>
            </div>
          )}

          {restoreResult && (
            <div className="p-5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl space-y-3">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <h4 className="text-sm font-bold">{restoreResult.message}</h4>
              </div>
              <p className="text-xs text-emerald-700">
                Mode applied: <strong>{restoreResult.mode.toUpperCase()}</strong>.
                All database entities and physical attachments have been successfully restored.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                <div className="bg-emerald-100/70 p-2 rounded">
                  Cost Sheets: <strong>{restoreResult.stats.cost_sheets ?? 0}</strong>
                </div>
                <div className="bg-emerald-100/70 p-2 rounded">
                  Line Items: <strong>{restoreResult.stats.line_items ?? 0}</strong>
                </div>
                <div className="bg-emerald-100/70 p-2 rounded">
                  Accounts: <strong>{restoreResult.stats.accounts ?? 0}</strong>
                </div>
                <div className="bg-emerald-100/70 p-2 rounded">
                  Files Extracted: <strong>{restoreResult.stats.physical_files_extracted ?? 0}</strong>
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reload Application to View Restored Data
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
