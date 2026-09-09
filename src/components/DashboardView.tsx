import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Percent, 
  FileText, 
  Filter, 
  RefreshCw, 
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  Plus
} from 'lucide-react';
import { apiRequest } from '../lib/api.ts';
import { CostSheet, User, DropdownOptions } from '../types.ts';

interface DashboardViewProps {
  onSelectCostSheet: (id: number) => void;
  onNewCostSheet: () => void;
  dropdowns: DropdownOptions;
  salespeople: User[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onSelectCostSheet,
  onNewCostSheet,
  dropdowns,
  salespeople,
}) => {
  const [financialYear, setFinancialYear] = useState('All');
  const [month, setMonth] = useState('All');
  const [status, setStatus] = useState('All');
  const [businessUnit, setBusinessUnit] = useState('All');
  const [salespersonId, setSalespersonId] = useState('All');

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (financialYear !== 'All') params.append('financial_year', financialYear);
      if (month !== 'All') params.append('month', month);
      if (status !== 'All') params.append('status', status);
      if (businessUnit !== 'All') params.append('business_unit', businessUnit);
      if (salespersonId !== 'All') params.append('salesperson_id', salespersonId);

      const data = await apiRequest(`/api/reports/dashboard?${params.toString()}`);
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [financialYear, month, status, businessUnit, salespersonId]);

  const monthsList = [
    { num: '1', name: 'January' },
    { num: '2', name: 'February' },
    { num: '3', name: 'March' },
    { num: '4', name: 'April' },
    { num: '5', name: 'May' },
    { num: '6', name: 'June' },
    { num: '7', name: 'July' },
    { num: '8', name: 'August' },
    { num: '9', name: 'September' },
    { num: '10', name: 'October' },
    { num: '11', name: 'November' },
    { num: '12', name: 'December' },
  ];

  const kpi = stats?.kpis || { total_deal_value: 0, total_profit: 0, avg_margin: 0, total_count: 0 };
  const trend = stats?.monthly_trend || [];
  const salespersonPerf = stats?.salesperson_performance || [];
  const statusDist = stats?.status_distribution || [];
  const recentSheets = stats?.recent_sheets || [];

  // Calculation for Doughnut Chart SVG
  const totalStatusCount = statusDist.reduce((acc: number, curr: any) => acc + parseInt(curr.count, 10), 0) || 1;
  const statusColors: { [key: string]: string } = {
    Approved: '#16a34a',
    Pending: '#d97706',
    Draft: '#64748b',
    Rejected: '#dc2626',
  };

  // Trend Chart Max
  const maxProfit = Math.max(...trend.map((t: any) => parseFloat(t.total_profit)), 100000);

  return (
    <div id="dashboard-view-container" className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Slicers / Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-blue-600" />
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Dashboard Slicers & Filters</h2>
          <button
            onClick={fetchStats}
            title="Refresh Data"
            className="ml-auto text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Financial Year */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Financial Year</label>
            <select
              id="filter-financial-year"
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Financial Years</option>
              <option value="2026-27">FY 2026-27</option>
              <option value="2025-26">FY 2025-26</option>
            </select>
          </div>

          {/* Month */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Month</label>
            <select
              id="filter-month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Months</option>
              {monthsList.map((m) => (
                <option key={m.num} value={m.num}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Status</label>
            <select
              id="filter-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Pending">Pending Approval</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Business Unit */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Business Unit</label>
            <select
              id="filter-business-unit"
              value={businessUnit}
              onChange={(e) => setBusinessUnit(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Business Units</option>
              {dropdowns.business_unit.map((bu) => (
                <option key={bu} value={bu}>{bu}</option>
              ))}
            </select>
          </div>

          {/* Salesperson */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Salesperson</label>
            <select
              id="filter-salesperson"
              value={salespersonId}
              onChange={(e) => setSalespersonId(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">All Salespeople</option>
              {salespeople.map((sp) => (
                <option key={sp.id} value={sp.id.toString()}>{sp.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Tiles (3 Required: Total Deal Value, Total Profit, Average Margin %) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Deal Value */}
        <div id="kpi-total-deal-value" className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Deal Value</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">
              ₹{Number(kpi.total_deal_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <span>Gross quotations volume</span>
            </p>
          </div>
        </div>

        {/* KPI 2: Total Profit */}
        <div id="kpi-total-profit" className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Profit</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-emerald-600">
              ₹{Number(kpi.total_profit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Net margin after discounts & add-ons
            </p>
          </div>
        </div>

        {/* KPI 3: Average Margin % */}
        <div id="kpi-average-margin" className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average Margin %</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-indigo-600">
              {Number(kpi.avg_margin).toFixed(2)}%
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Target threshold: ≥ 18.00%
            </p>
          </div>
        </div>

        {/* KPI 4: Total Cost Sheets Count */}
        <div id="kpi-total-sheets" className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quotations Count</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-900">
              {kpi.total_count}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Active sheets in system
            </p>
          </div>
        </div>
      </div>

      {/* Charts Section: Monthly Profit Trend (Line), Salesperson Performance (Bar), Status Distribution (Doughnut) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Monthly Profit Trend (Line Chart) */}
        <div id="chart-monthly-profit-trend" className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Monthly Profit Trend</h3>
              <p className="text-xs text-slate-500">Historical net profit generated across quotes</p>
            </div>
            <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              Line Chart
            </span>
          </div>

          <div className="h-60 w-full relative flex items-end pt-4 pb-6 px-2">
            {trend.length === 0 ? (
              <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
                No trend data available for current filter selection
              </div>
            ) : (
              <div className="w-full h-full flex flex-col justify-end">
                {/* SVG Visual Line and Bars */}
                <div className="relative h-44 w-full flex items-end gap-3 px-4">
                  {trend.map((t: any, idx: number) => {
                    const profit = parseFloat(t.total_profit) || 0;
                    const heightPercent = Math.max(12, Math.min(95, (profit / maxProfit) * 100));
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                        {/* Hover Tooltip */}
                        <div className="opacity-0 group-hover:opacity-100 transition absolute -top-8 bg-slate-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-10 pointer-events-none">
                          ₹{Number(profit).toLocaleString('en-IN')}: {t.month_label}
                        </div>
                        {/* Bar */}
                        <div 
                          style={{ height: `${heightPercent}%` }}
                          className="w-full max-w-[48px] bg-gradient-to-t from-blue-600 to-indigo-500 rounded-t-md group-hover:from-blue-500 group-hover:to-indigo-400 transition"
                        />
                        {/* X-axis Label */}
                        <span className="text-[10px] text-slate-500 mt-2 truncate w-full text-center">
                          {t.month_label.split(' ')[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chart 3: Status Distribution (Doughnut Chart) */}
        <div id="chart-status-distribution" className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Status Distribution</h3>
              <p className="text-xs text-slate-500">Workflow stage breakdown</p>
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
              Doughnut
            </span>
          </div>

          <div className="flex flex-col items-center justify-center py-2">
            {/* Donut Chart representation */}
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="15.91549430918954"
                  fill="transparent"
                  stroke="#e2e8f0"
                  strokeWidth="3.5"
                />
                {(() => {
                  let accumulatedPercent = 0;
                  return statusDist.map((item: any, i: number) => {
                    const count = parseInt(item.count, 10);
                    const percent = (count / totalStatusCount) * 100;
                    const strokeDasharray = `${percent} ${100 - percent}`;
                    const strokeDashoffset = -accumulatedPercent;
                    accumulatedPercent += percent;
                    const color = statusColors[item.status] || '#94a3b8';

                    return (
                      <circle
                        key={i}
                        cx="18"
                        cy="18"
                        r="15.91549430918954"
                        fill="transparent"
                        stroke={color}
                        strokeWidth="3.8"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-500"
                      />
                    );
                  });
                })()}
              </svg>
              <div className="absolute text-center">
                <span className="text-xl font-bold text-slate-900">{kpi.total_count}</span>
                <span className="block text-[10px] text-slate-400">Quotes</span>
              </div>
            </div>

            {/* Legend */}
            <div className="w-full mt-4 space-y-1.5">
              {['Draft', 'Pending', 'Approved', 'Rejected'].map((st) => {
                const found = statusDist.find((d: any) => d.status === st);
                const count = found ? parseInt(found.count, 10) : 0;
                const percent = Math.round((count / totalStatusCount) * 100);
                const color = statusColors[st];

                return (
                  <div key={st} className="flex items-center justify-between text-xs py-0.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-slate-600">{st}</span>
                    </div>
                    <span className="font-semibold text-slate-800">{count} ({percent}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Chart 2 & Recent Cost Sheets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Salesperson Performance (Bar Chart) */}
        <div id="chart-salesperson-performance" className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Salesperson Performance</h3>
              <p className="text-xs text-slate-500">Deal volume by representative</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {salespersonPerf.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">No salesperson deals recorded</div>
            ) : (
              salespersonPerf.map((sp: any, i: number) => {
                const maxDeal = Math.max(...salespersonPerf.map((s: any) => parseFloat(s.total_deal_value)), 1);
                const barWidth = Math.max(8, Math.min(100, (parseFloat(sp.total_deal_value) / maxDeal) * 100));

                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-slate-700">
                      <span className="truncate max-w-[140px]">{sp.salesperson_name}</span>
                      <span className="font-bold text-slate-900">₹{Number(sp.total_deal_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>{sp.deal_count} deal{sp.deal_count !== 1 ? 's' : ''}</span>
                      <span>Profit: ₹{Number(sp.total_profit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Quotes List */}
        <div id="dashboard-recent-quotes" className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Recent Quotations & Cost Sheets</h3>
              <p className="text-xs text-slate-500">Quick access to active and recent deals</p>
            </div>
            <button
              onClick={onNewCostSheet}
              className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Quote</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-medium">
                  <th className="pb-2">Sheet Number</th>
                  <th className="pb-2">Subject / Customer</th>
                  <th className="pb-2 text-right">Deal Value</th>
                  <th className="pb-2 text-right">Margin %</th>
                  <th className="pb-2 text-center">Status</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentSheets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      No cost sheets found. Click "Create Quote" to start.
                    </td>
                  </tr>
                ) : (
                  recentSheets.map((sheet: any) => (
                    <tr key={sheet.id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 font-bold text-blue-600">{sheet.cs_number}</td>
                      <td className="py-2.5">
                        <p className="font-semibold text-slate-800 truncate max-w-[200px]">{sheet.subject}</p>
                        <p className="text-[11px] text-slate-500 truncate">{sheet.account_name || 'Direct Customer'}</p>
                      </td>
                      <td className="py-2.5 text-right font-medium text-slate-900">
                        ₹{Number(sheet.total_sale).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-emerald-600">
                        {Number(sheet.margin_percentage).toFixed(2)}%
                      </td>
                      <td className="py-2.5 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          sheet.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                          sheet.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                          sheet.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {sheet.status === 'Pending' ? `Stage ${sheet.current_stage}` : sheet.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => onSelectCostSheet(sheet.id)}
                          className="px-2.5 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded font-medium transition cursor-pointer"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
