import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  X, 
  Save, 
  Send, 
  Printer, 
  FileDown, 
  Plus, 
  Trash2, 
  FileSpreadsheet, 
  FileText, 
  Upload, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle, 
  DollarSign, 
  Percent, 
  User as UserIcon, 
  Layers,
  Paperclip,
  ArrowRight,
  ShieldCheck,
  Check
} from 'lucide-react';
import { CostSheet, LineItem, User, Account, DropdownOptions, UploadedFile } from '../types.ts';
import { STAGE_NAMES, STAGE_SHORT_NAMES, STAGE_DESCRIPTIONS } from '../lib/constants.ts';
import { apiRequest } from '../lib/api.ts';
import { generateCostSheetPDF } from '../lib/pdfGenerator.ts';

interface CostSheetModalProps {
  costSheetId: number | null; // null means create new
  onClose: () => void;
  onSaved: () => void;
  currentUser: User;
  accounts: Account[];
  salespeople: User[];
  dropdowns: DropdownOptions;
  approverCandidates: { [key: number]: User[] };
}

export const CostSheetModal: React.FC<CostSheetModalProps> = ({
  costSheetId,
  onClose,
  onSaved,
  currentUser,
  accounts,
  salespeople,
  dropdowns,
  approverCandidates,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'line_items' | 'workflow' | 'attachments'>('overview');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Workflow Approval Action State
  const [approvalComment, setApprovalComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // File Upload State
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [parsingPdf, setParsingPdf] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  // Cost Sheet Form State
  const [sheetData, setSheetData] = useState<Partial<CostSheet>>({
    subject: '',
    account_id: accounts[0]?.id || undefined,
    salesperson_id: currentUser.id,
    business_unit: dropdowns.business_unit[0] || 'Enterprise Solutions',
    oem: dropdowns.oem[0] || 'Cisco Systems',
    distributor: dropdowns.distributor[0] || 'Ingram Micro',
    currency: 'INR',
    discount_type: 'Percentage',
    discount_value: 0,
    consultation_charges: 0,
    freight_charges: 0,
    notes: '',
    assigned_approvers: {
      '1': approverCandidates[1]?.[0]?.id || 2,
      '2': approverCandidates[2]?.[0]?.id || 3,
      '3': approverCandidates[3]?.[0]?.id || 4,
      '4': approverCandidates[4]?.[0]?.id || 5,
      '5': approverCandidates[5]?.[0]?.id || 6,
      '6': approverCandidates[6]?.[0]?.id || 7,
    },
    line_items: [
      {
        description: 'Server / Core Switch Hardware',
        unit_purchase: 120000,
        unit_sale: 155000,
        quantity: 1,
        total_purchase: 120000,
        total_sale: 155000,
        margin_percentage: 22.58,
      },
    ],
  });

  const [fullCostSheet, setFullCostSheet] = useState<CostSheet | null>(null);

  // Load existing cost sheet if editing
  useEffect(() => {
    if (costSheetId) {
      loadCostSheet(costSheetId);
    }
  }, [costSheetId]);

  const loadCostSheet = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest(`/api/cost-sheets/${id}`);
      setFullCostSheet(data);
      setSheetData({
        ...data,
        assigned_approvers: data.assigned_approvers || {},
        line_items: data.line_items || [],
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load cost sheet');
    } finally {
      setLoading(false);
    }
  };

  // Recalculate financial figures whenever line items, discounts, or charges change
  const computeTotals = () => {
    const items = sheetData.line_items || [];
    const totalPurchase = items.reduce((sum, item) => sum + (Number(item.total_purchase) || 0), 0);
    const totalSale = items.reduce((sum, item) => sum + (Number(item.total_sale) || 0), 0);

    const discType = sheetData.discount_type || 'Percentage';
    const discVal = Number(sheetData.discount_value) || 0;
    const discountAmount = discType === 'Percentage'
      ? (totalPurchase * (discVal / 100))
      : discVal;

    const consultation = Number(sheetData.consultation_charges) || 0;
    const freight = Number(sheetData.freight_charges) || 0;

    const netPurchase = Math.max(0, (totalPurchase - discountAmount) + consultation + freight);
    const netProfit = totalSale - netPurchase;
    const marginPercent = totalSale > 0 ? (netProfit / totalSale) * 100 : 0;

    return {
      totalPurchase,
      totalSale,
      discountAmount,
      netPurchase,
      netProfit,
      marginPercent,
    };
  };

  const totals = computeTotals();

  // Line Item Handlers
  const handleLineItemChange = (index: number, field: keyof LineItem, val: any) => {
    const updated = [...(sheetData.line_items || [])];
    const current = { ...updated[index], [field]: val };

    const qty = Number(field === 'quantity' ? val : current.quantity) || 1;
    const uPur = Number(field === 'unit_purchase' ? val : current.unit_purchase) || 0;
    const uSale = Number(field === 'unit_sale' ? val : current.unit_sale) || 0;

    const totPur = qty * uPur;
    const totSale = qty * uSale;
    const margin = totSale > 0 ? ((totSale - totPur) / totSale) * 100 : 0;

    current.total_purchase = totPur;
    current.total_sale = totSale;
    current.margin_percentage = parseFloat(margin.toFixed(2));

    updated[index] = current;
    setSheetData({ ...sheetData, line_items: updated });
  };

  const addLineItem = () => {
    const updated = [
      ...(sheetData.line_items || []),
      {
        description: 'New Product Item',
        unit_purchase: 10000,
        unit_sale: 13000,
        quantity: 1,
        total_purchase: 10000,
        total_sale: 13000,
        margin_percentage: 23.08,
      },
    ];
    setSheetData({ ...sheetData, line_items: updated });
  };

  const removeLineItem = (index: number) => {
    const updated = [...(sheetData.line_items || [])];
    if (updated.length <= 1) {
      alert('A cost sheet must have at least one line item.');
      return;
    }
    updated.splice(index, 1);
    setSheetData({ ...sheetData, line_items: updated });
  };

  // Approver Assignment change
  const handleApproverChange = (stageNumber: number, userId: number) => {
    setSheetData({
      ...sheetData,
      assigned_approvers: {
        ...(sheetData.assigned_approvers || {}),
        [stageNumber.toString()]: userId,
      },
    });
  };

  // Excel Import Handler (.xlsx / .csv)
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (rows.length === 0) {
          alert('No data rows found in the uploaded Excel file.');
          return;
        }

        const importedItems: LineItem[] = rows.map((r, idx) => {
          // Normalize column names
          const desc = r.Description || r.Item || r.Product || r.Particulars || `Item #${idx + 1}`;
          const qty = Number(r.Quantity || r.Qty || r.qty || 1);
          const uPur = Number(r['Purchase Price'] || r.UnitPurchase || r.Purchase || r.Cost || 0);
          const uSale = Number(r['Sale Price'] || r.UnitSale || r.Sale || (uPur > 0 ? uPur * 1.25 : 0));

          const totPur = qty * uPur;
          const totSale = qty * uSale;
          const margin = totSale > 0 ? ((totSale - totPur) / totSale) * 100 : 0;

          return {
            description: String(desc),
            quantity: qty > 0 ? qty : 1,
            unit_purchase: uPur,
            unit_sale: uSale,
            total_purchase: totPur,
            total_sale: totSale,
            margin_percentage: parseFloat(margin.toFixed(2)),
          };
        });

        setSheetData({
          ...sheetData,
          line_items: [...(sheetData.line_items || []), ...importedItems],
        });
        setSuccessMsg(`Successfully imported ${importedItems.length} line items from Excel!`);
      } catch (err: any) {
        alert('Failed to parse Excel file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // PDF Parser Handler (Uploads PDF to server, extracts line items with regex)
  const handlePdfParserUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsingPdf(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiRequest('/api/uploads/parse-pdf-lines', {
        method: 'POST',
        body: formData,
      });

      if (res.items && res.items.length > 0) {
        const parsedItems: LineItem[] = res.items.map((item: any) => ({
          description: item.description,
          unit_purchase: item.unit_purchase,
          unit_sale: item.unit_sale,
          quantity: item.quantity,
          total_purchase: item.total_purchase,
          total_sale: item.total_sale,
          margin_percentage: item.margin_percentage,
        }));

        setSheetData({
          ...sheetData,
          line_items: [...(sheetData.line_items || []), ...parsedItems],
        });
        setSuccessMsg(`PDF parsed successfully! Imported ${parsedItems.length} candidate line items.`);
      } else {
        alert('No tabular line items could be detected in this PDF. You may add items manually or via Excel.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to extract line items from PDF');
    } finally {
      setParsingPdf(false);
      e.target.value = '';
    }
  };

  // Attachment Upload Handler
  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fullCostSheet?.id) {
      alert('Please save the cost sheet first before adding attachments.');
      return;
    }

    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('cost_sheet_id', fullCostSheet.id.toString());

      const res = await apiRequest('/api/uploads/attachment', {
        method: 'POST',
        body: formData,
      });

      setSuccessMsg('Attachment uploaded successfully!');
      // Refresh sheet to update files list
      loadCostSheet(fullCostSheet.id);
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploadingAttachment(false);
      e.target.value = '';
    }
  };

  // Save Cost Sheet (Draft or Update)
  const handleSave = async (submitNow = false) => {
    setSaving(true);
    setError(null);
    try {
      let savedId = costSheetId;

      if (!sheetData.subject || sheetData.subject.trim() === '') {
        throw new Error('Deal subject is required.');
      }

      if (costSheetId) {
        // Update existing
        await apiRequest(`/api/cost-sheets/${costSheetId}`, {
          method: 'PUT',
          body: JSON.stringify(sheetData),
        });
      } else {
        // Create new
        const created = await apiRequest('/api/cost-sheets', {
          method: 'POST',
          body: JSON.stringify(sheetData),
        });
        savedId = created.id;
      }

      if (submitNow && savedId) {
        setSubmitting(true);
        await apiRequest(`/api/cost-sheets/${savedId}/submit`, {
          method: 'POST',
        });
      }

      setSuccessMsg(submitNow ? 'Cost sheet submitted for approval!' : 'Cost sheet saved successfully!');
      setTimeout(() => {
        onSaved();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to save cost sheet');
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  };

  // Approve Workflow Stage
  const handleApprove = async () => {
    if (!fullCostSheet) return;
    setActionLoading(true);
    setError(null);
    try {
      await apiRequest(`/api/cost-sheets/${fullCostSheet.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ comment: approvalComment }),
      });
      setApprovalComment('');
      setSuccessMsg(`Stage ${fullCostSheet.current_stage} approved successfully!`);
      loadCostSheet(fullCostSheet.id);
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to approve stage');
    } finally {
      setActionLoading(false);
    }
  };

  // Reject Workflow Stage
  const handleReject = async () => {
    if (!fullCostSheet) return;
    if (!approvalComment.trim()) {
      setError('Please provide a reason / comment for rejecting the sheet.');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await apiRequest(`/api/cost-sheets/${fullCostSheet.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ comment: approvalComment }),
      });
      setApprovalComment('');
      setSuccessMsg('Cost sheet has been rejected.');
      loadCostSheet(fullCostSheet.id);
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to reject stage');
    } finally {
      setActionLoading(false);
    }
  };

  // Check if current user can approve current stage
  const currentStage = fullCostSheet?.current_stage || 1;
  const assignedForCurrent = fullCostSheet?.assigned_approvers?.[currentStage.toString()];
  const canApprove = 
    fullCostSheet?.status === 'Pending' && 
    (currentUser.access_level === 'Admin' || assignedForCurrent === currentUser.id);

  return (
    <div id="cost-sheet-modal-backdrop" className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div id="cost-sheet-modal-container" className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {fullCostSheet ? `Cost Sheet: ${fullCostSheet.cs_number}` : 'New Quotation Cost Sheet'}
                </h2>
                {fullCostSheet && (
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    fullCostSheet.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                    fullCostSheet.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                    fullCostSheet.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                    'bg-slate-200 text-slate-700'
                  }`}>
                    {fullCostSheet.status === 'Pending' ? `Stage ${fullCostSheet.current_stage}: Pending` : fullCostSheet.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {sheetData.subject || 'Draft quotation and sequential margin routing'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Generate Branded Landscape PDF */}
            {fullCostSheet && (
              <button
                id="generate-pdf-modal-button"
                onClick={() => generateCostSheetPDF(fullCostSheet)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                title="Download Landscape Branded PDF Quotation"
              >
                <FileDown className="w-3.5 h-3.5 text-blue-600" />
                <span>Download PDF</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs (3 Main Tabs + Attachments) */}
        <div className="px-6 border-b border-slate-200 bg-white flex gap-6">
          <button
            id="tab-overview"
            onClick={() => setActiveTab('overview')}
            className={`py-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>1. Deal Overview & Approvers</span>
          </button>

          <button
            id="tab-line-items"
            onClick={() => setActiveTab('line_items')}
            className={`py-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'line_items'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>2. Line Items & Profitability</span>
            <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded-full text-[10px]">
              {sheetData.line_items?.length || 0}
            </span>
          </button>

          <button
            id="tab-workflow"
            onClick={() => setActiveTab('workflow')}
            className={`py-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'workflow'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>3. Sequential Approval (6 Stages)</span>
            {canApprove && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </button>

          <button
            id="tab-attachments"
            onClick={() => setActiveTab('attachments')}
            className={`py-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'attachments'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Paperclip className="w-3.5 h-3.5" />
            <span>4. Attachments</span>
            <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded-full text-[10px]">
              {fullCostSheet?.files?.length || 0}
            </span>
          </button>
        </div>

        {/* Notification Banners */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Modal Body Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-20 text-center text-xs text-slate-500">Loading cost sheet details...</div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Deal Metadata */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Subject */}
                    <div className="lg:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Deal Subject / Project Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={sheetData.subject || ''}
                        onChange={(e) => setSheetData({ ...sheetData, subject: e.target.value })}
                        placeholder="e.g. Cisco Enterprise Core Switch Refresh & Firewall Setup"
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Customer Account */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Customer Account *
                      </label>
                      <select
                        value={sheetData.account_id || ''}
                        onChange={(e) => setSheetData({ ...sheetData, account_id: parseInt(e.target.value, 10) })}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500"
                      >
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.industry || 'General'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Salesperson */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Sales Representative
                      </label>
                      <select
                        value={sheetData.salesperson_id || ''}
                        onChange={(e) => setSheetData({ ...sheetData, salesperson_id: parseInt(e.target.value, 10) })}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500"
                      >
                        {salespeople.map((sp) => (
                          <option key={sp.id} value={sp.id}>
                            {sp.name} ({sp.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Business Unit */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Business Unit
                      </label>
                      <select
                        value={sheetData.business_unit || ''}
                        onChange={(e) => setSheetData({ ...sheetData, business_unit: e.target.value })}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500"
                      >
                        {dropdowns.business_unit.map((bu) => (
                          <option key={bu} value={bu}>{bu}</option>
                        ))}
                      </select>
                    </div>

                    {/* OEM */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        OEM
                      </label>
                      <select
                        value={sheetData.oem || ''}
                        onChange={(e) => setSheetData({ ...sheetData, oem: e.target.value })}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500"
                      >
                        {dropdowns.oem.map((oem) => (
                          <option key={oem} value={oem}>{oem}</option>
                        ))}
                      </select>
                    </div>

                    {/* Distributor */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Distributor
                      </label>
                      <select
                        value={sheetData.distributor || ''}
                        onChange={(e) => setSheetData({ ...sheetData, distributor: e.target.value })}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500"
                      >
                        {dropdowns.distributor.map((dist) => (
                          <option key={dist} value={dist}>{dist}</option>
                        ))}
                      </select>
                    </div>

                    {/* Currency */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Currency
                      </label>
                      <select
                        value={sheetData.currency || 'INR'}
                        onChange={(e) => setSheetData({ ...sheetData, currency: e.target.value })}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="INR">INR (₹ - Indian Rupee)</option>
                        <option value="USD">USD ($ - US Dollar)</option>
                        <option value="EUR">EUR (€ - Euro)</option>
                      </select>
                    </div>

                    {/* Notes / Special Terms */}
                    <div className="lg:col-span-3">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Internal Notes & Commercial Observations
                      </label>
                      <textarea
                        rows={2}
                        value={sheetData.notes || ''}
                        onChange={(e) => setSheetData({ ...sheetData, notes: e.target.value })}
                        placeholder="Payment terms, special vendor discounts, warranty terms or delivery lead times..."
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* 6-Stage Approver Selection Grid */}
                  <div className="pt-4 border-t border-slate-200">
                    <div className="mb-3">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Assigned Approvers for 6-Stage Sequential Chain
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Designate specific stage reviewers. Stages will be activated sequentially from Stage 1 to 6.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {[1, 2, 3, 4, 5, 6].map((stageNum) => {
                        const candidates = approverCandidates[stageNum] || [];
                        const currentAssigned = sheetData.assigned_approvers?.[stageNum.toString()];

                        return (
                          <div key={stageNum} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                                Stage {stageNum}
                              </span>
                              <span className="text-xs font-semibold text-slate-800">
                                {STAGE_SHORT_NAMES[stageNum]}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 line-clamp-1">
                              {STAGE_DESCRIPTIONS[stageNum]}
                            </p>
                            <select
                              value={currentAssigned || ''}
                              onChange={(e) => handleApproverChange(stageNum, parseInt(e.target.value, 10))}
                              className="w-full text-xs bg-white border border-slate-300 rounded-lg p-1.5 focus:ring-1 focus:ring-blue-500"
                            >
                              {candidates.length === 0 ? (
                                <option value="">No users found</option>
                              ) : (
                                candidates.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name} ({u.role} - {u.access_level})
                                  </option>
                                ))
                              )}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: LINE ITEMS & PROFITABILITY */}
              {activeTab === 'line_items' && (
                <div className="space-y-6">
                  {/* Actions Header: Add Product, Excel Import, PDF Parser */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={addLineItem}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Line Item</span>
                      </button>

                      {/* Excel Import */}
                      <button
                        onClick={() => excelInputRef.current?.click()}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                        title="Import Line Items from .xlsx or .csv"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Import Excel</span>
                      </button>
                      <input
                        ref={excelInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={handleExcelImport}
                      />

                      {/* PDF Line Item Importer */}
                      <button
                        onClick={() => pdfInputRef.current?.click()}
                        disabled={parsingPdf}
                        className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                        title="Upload Vendor PDF Quote to parse Line Items"
                      >
                        <FileText className="w-3.5 h-3.5 text-purple-600" />
                        <span>{parsingPdf ? 'Parsing PDF Lines...' : 'PDF Line Item Importer'}</span>
                      </button>
                      <input
                        ref={pdfInputRef}
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={handlePdfParserUpload}
                      />
                    </div>

                    <span className="text-xs text-slate-500">
                      Total Items: <strong>{sheetData.line_items?.length || 0}</strong>
                    </span>
                  </div>

                  {/* Line Items Table */}
                  <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-800 text-white font-semibold">
                          <th className="p-2.5 w-10 text-center">#</th>
                          <th className="p-2.5 min-w-[200px]">Item Description</th>
                          <th className="p-2.5 w-20 text-center">Qty</th>
                          <th className="p-2.5 w-32 text-right">Unit Purchase</th>
                          <th className="p-2.5 w-32 text-right">Total Purchase</th>
                          <th className="p-2.5 w-32 text-right">Unit Sale</th>
                          <th className="p-2.5 w-32 text-right">Total Sale</th>
                          <th className="p-2.5 w-24 text-center">Margin %</th>
                          <th className="p-2.5 w-12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {sheetData.line_items?.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="p-2 text-center text-slate-400 font-bold">{idx + 1}</td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => handleLineItemChange(idx, 'description', e.target.value)}
                                className="w-full text-xs bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none p-1 font-medium"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => handleLineItemChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                                className="w-full text-xs text-center bg-transparent border border-slate-200 rounded p-1"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min={0}
                                value={item.unit_purchase}
                                onChange={(e) => handleLineItemChange(idx, 'unit_purchase', parseFloat(e.target.value) || 0)}
                                className="w-full text-xs text-right bg-transparent border border-slate-200 rounded p-1"
                              />
                            </td>
                            <td className="p-2 text-right font-semibold text-slate-700">
                              ₹{Number(item.total_purchase).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min={0}
                                value={item.unit_sale}
                                onChange={(e) => handleLineItemChange(idx, 'unit_sale', parseFloat(e.target.value) || 0)}
                                className="w-full text-xs text-right bg-transparent border border-slate-200 rounded p-1 font-medium text-blue-700"
                              />
                            </td>
                            <td className="p-2 text-right font-bold text-blue-600">
                              ₹{Number(item.total_sale).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2 text-center">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                item.margin_percentage >= 18 ? 'bg-emerald-100 text-emerald-800' :
                                item.margin_percentage >= 10 ? 'bg-amber-100 text-amber-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {Number(item.margin_percentage).toFixed(2)}%
                              </span>
                            </td>
                            <td className="p-2 text-center">
                              <button
                                onClick={() => removeLineItem(idx)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
                                title="Remove Item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Commercial Add-ons and Discounts Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    {/* Discount Control */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Vendor / Deal Discount
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={sheetData.discount_type || 'Percentage'}
                          onChange={(e) => setSheetData({ ...sheetData, discount_type: e.target.value as any })}
                          className="text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="Percentage">% Percent</option>
                          <option value="Value">₹ Fixed Value</option>
                        </select>
                        <input
                          type="number"
                          min={0}
                          value={sheetData.discount_value || 0}
                          onChange={(e) => setSheetData({ ...sheetData, discount_value: parseFloat(e.target.value) || 0 })}
                          className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 text-right focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Consultation Charges */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Consultation / Engineering Charges (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={sheetData.consultation_charges || 0}
                        onChange={(e) => setSheetData({ ...sheetData, consultation_charges: parseFloat(e.target.value) || 0 })}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 text-right focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {/* Freight Charges */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Freight & Shipping Charges (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={sheetData.freight_charges || 0}
                        onChange={(e) => setSheetData({ ...sheetData, freight_charges: parseFloat(e.target.value) || 0 })}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 text-right focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Live Profitability Calculation Summary Card */}
                  <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl shadow-lg">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                      Commercial Profitability Breakdown
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Sum of Purchase:</span>
                        <span className="font-semibold text-slate-200">
                          ₹{totals.totalPurchase.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[11px]">Discount:</span>
                        <span className="font-semibold text-red-400">
                          - ₹{totals.discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[11px]">Consult + Freight:</span>
                        <span className="font-semibold text-slate-200">
                          + ₹{((sheetData.consultation_charges || 0) + (sheetData.freight_charges || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="border-l border-slate-700 pl-3">
                        <span className="text-slate-400 block text-[11px]">Net Purchase Cost:</span>
                        <span className="font-bold text-amber-300">
                          ₹{totals.netPurchase.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[11px]">Total Sale (Deal Value):</span>
                        <span className="font-bold text-blue-400">
                          ₹{totals.totalSale.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700">
                        <span className="text-slate-300 block text-[10px] font-semibold">Net Profit / Margin:</span>
                        <span className="text-base font-extrabold text-emerald-400 block">
                          ₹{totals.netProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                        <span className="text-xs font-bold text-emerald-300">
                          {totals.marginPercent.toFixed(2)}% Margin
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: WORKFLOW & COMMENTS */}
              {activeTab === 'workflow' && (
                <div className="space-y-6">
                  {/* 6-Stage Visual Stepper */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">
                      Sequential Approval Stepper (Stage 1 to 6)
                    </h3>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      {[1, 2, 3, 4, 5, 6].map((stg) => {
                        const log = fullCostSheet?.approval_logs?.find((l) => l.stage_number === stg);
                        const isApproved = log?.decision === 'Approved';
                        const isRejected = log?.decision === 'Rejected';
                        const isCurrent = fullCostSheet?.current_stage === stg && fullCostSheet?.status === 'Pending';
                        const isPendingFuture = (fullCostSheet?.current_stage || 1) < stg;

                        return (
                          <div
                            key={stg}
                            className={`p-3 rounded-xl border text-xs transition relative ${
                              isApproved ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900' :
                              isRejected ? 'bg-red-50/80 border-red-300 text-red-900' :
                              isCurrent ? 'bg-amber-50 border-amber-400 text-amber-900 ring-2 ring-amber-400/40' :
                              'bg-white border-slate-200 text-slate-500'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] bg-white border">
                                {stg}
                              </span>
                              {isApproved && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                              {isRejected && <XCircle className="w-4 h-4 text-red-600" />}
                              {isCurrent && <Clock className="w-4 h-4 text-amber-600 animate-spin" />}
                            </div>

                            <p className="font-bold text-xs">{STAGE_SHORT_NAMES[stg]}</p>
                            <p className="text-[10px] mt-0.5 opacity-80">
                              {isApproved ? `Approved on ${new Date(log!.timestamp).toLocaleDateString('en-GB')}` :
                               isRejected ? `Rejected` :
                               isCurrent ? `Awaiting Review` :
                               `Upcoming Stage`}
                            </p>

                            {log && (
                              <p className="text-[10px] font-semibold mt-1">
                                By: {log.actor_name || 'Reviewer'}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Reviewer Approval / Rejection Action Card */}
                  {canApprove && (
                    <div id="reviewer-action-box" className="p-5 bg-blue-50 border-2 border-blue-400 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                        <ShieldCheck className="w-5 h-5 text-blue-600" />
                        <span>Action Required: You are the assigned reviewer for Stage {currentStage} ({STAGE_NAMES[currentStage]})</span>
                      </div>
                      <p className="text-xs text-blue-700">
                        Please review deal profitability, line items, and terms. You may approve the quote to advance to the next sequential stage, or reject it back to the initiator.
                      </p>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Reviewer Remarks / Feedback (Required if rejecting)
                        </label>
                        <textarea
                          rows={2}
                          value={approvalComment}
                          onChange={(e) => setApprovalComment(e.target.value)}
                          placeholder="Provide approval comments, margin sign-off notes, or rejection reasons..."
                          className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        <button
                          id="btn-approve-stage"
                          onClick={handleApprove}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                          <span>{actionLoading ? 'Processing...' : `Approve Stage ${currentStage}`}</span>
                        </button>

                        <button
                          id="btn-reject-stage"
                          onClick={handleReject}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>{actionLoading ? 'Processing...' : 'Reject Cost Sheet'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Chronological Approval Logs Table */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                      Approval & Review Audit Trail
                    </h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-semibold">
                            <th className="p-2.5">Timestamp</th>
                            <th className="p-2.5">Stage</th>
                            <th className="p-2.5">Reviewer</th>
                            <th className="p-2.5">Decision</th>
                            <th className="p-2.5">Comments</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {fullCostSheet?.approval_logs?.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-4 text-center text-slate-400">
                                No review actions have been recorded yet.
                              </td>
                            </tr>
                          ) : (
                            fullCostSheet?.approval_logs?.map((log) => (
                              <tr key={log.id} className="hover:bg-slate-50">
                                <td className="p-2.5 text-slate-500 whitespace-nowrap">
                                  {new Date(log.timestamp).toLocaleString('en-GB')}
                                </td>
                                <td className="p-2.5 font-bold text-slate-800">
                                  Stage {log.stage_number}: {log.stage_name}
                                </td>
                                <td className="p-2.5 font-medium text-slate-700">
                                  {log.actor_name} ({log.actor_role})
                                </td>
                                <td className="p-2.5">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    log.decision === 'Approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                  }`}>
                                    {log.decision}
                                  </span>
                                </td>
                                <td className="p-2.5 text-slate-600 italic">
                                  {log.comment || 'No comment recorded'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: ATTACHMENTS */}
              {activeTab === 'attachments' && (
                <div className="space-y-6">
                  <div className="p-6 border-2 border-dashed border-slate-300 rounded-xl text-center bg-slate-50">
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <h4 className="text-xs font-bold text-slate-800">Upload Deal Documentation</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 mb-3">
                      Attach vendor quotations, customer specifications, POs, or scope of work (PDF, DOCX, XLSX). Files are safely stored to `./uploads/`.
                    </p>

                    <button
                      onClick={() => attachmentInputRef.current?.click()}
                      disabled={uploadingAttachment}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>{uploadingAttachment ? 'Uploading to server...' : 'Choose File to Attach'}</span>
                    </button>
                    <input
                      ref={attachmentInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleAttachmentUpload}
                    />
                  </div>

                  {/* Uploaded Files Table */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                      Attached Documents ({fullCostSheet?.files?.length || 0})
                    </h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-semibold">
                            <th className="p-2.5">File Name</th>
                            <th className="p-2.5">Size</th>
                            <th className="p-2.5">Uploaded Date</th>
                            <th className="p-2.5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(!fullCostSheet?.files || fullCostSheet.files.length === 0) ? (
                            <tr>
                              <td colSpan={4} className="p-4 text-center text-slate-400">
                                No attachments uploaded yet.
                              </td>
                            </tr>
                          ) : (
                            fullCostSheet.files.map((f) => (
                              <tr key={f.id} className="hover:bg-slate-50">
                                <td className="p-2.5 font-medium text-slate-800 flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                  <span className="truncate max-w-sm">{f.original_name}</span>
                                </td>
                                <td className="p-2.5 text-slate-500">
                                  {(f.file_size / 1024).toFixed(1)} KB
                                </td>
                                <td className="p-2.5 text-slate-500">
                                  {new Date(f.uploaded_at).toLocaleDateString('en-GB')}
                                </td>
                                <td className="p-2.5 text-right">
                                  <a
                                    href={f.file_path}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2.5 py-1 text-blue-600 hover:bg-blue-50 rounded font-semibold text-xs transition"
                                  >
                                    View / Download
                                  </a>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {fullCostSheet?.status ? `Status: ${fullCostSheet.status}` : 'Status: New Draft'}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>

            {/* Save Draft */}
            <button
              id="save-draft-button"
              onClick={() => handleSave(false)}
              disabled={saving || submitting}
              className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5 text-slate-600" />
              <span>{saving ? 'Saving...' : 'Save Draft'}</span>
            </button>

            {/* Submit for Approval */}
            {(!fullCostSheet || fullCostSheet.status === 'Draft' || fullCostSheet.status === 'Rejected') && (
              <button
                id="submit-approval-button"
                onClick={() => handleSave(true)}
                disabled={saving || submitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Submitting...' : 'Submit to Sequential Workflow'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
