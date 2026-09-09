import { Response } from 'express';
import * as XLSX from 'xlsx';
import { query } from '../config/db.ts';
import { AuthRequest } from '../middleware/auth.ts';

export async function getDashboardStats(req: AuthRequest, res: Response) {
  try {
    const {
      status,
      business_unit,
      salesperson_id,
      month,
      financial_year,
    } = req.query;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let pIndex = 1;

    if (status && status !== 'All') {
      whereClause += ` AND cs.status = $${pIndex++}`;
      params.push(status);
    }
    if (business_unit && business_unit !== 'All') {
      whereClause += ` AND cs.business_unit = $${pIndex++}`;
      params.push(business_unit);
    }
    if (salesperson_id && salesperson_id !== 'All') {
      whereClause += ` AND cs.salesperson_id = $${pIndex++}`;
      params.push(salesperson_id);
    }
    if (month && month !== 'All') {
      whereClause += ` AND EXTRACT(MONTH FROM cs.created_at) = $${pIndex++}`;
      params.push(parseInt(month as string, 10));
    }
    if (financial_year && financial_year !== 'All') {
      whereClause += ` AND cs.cs_number LIKE $${pIndex++}`;
      params.push(`%${financial_year}%`);
    }

    // Aggregate KPIs
    const kpiRes = await query(`
      SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(cs.total_sale), 0) as total_deal_value,
        COALESCE(SUM(cs.net_profit), 0) as total_profit,
        COALESCE(AVG(cs.margin_percentage), 0) as avg_margin
      FROM cost_sheets cs
      ${whereClause}
    `, params);

    const kpis = {
      total_count: parseInt(kpiRes.rows[0]?.total_count || '0', 10),
      total_deal_value: parseFloat(kpiRes.rows[0]?.total_deal_value || '0'),
      total_profit: parseFloat(kpiRes.rows[0]?.total_profit || '0'),
      avg_margin: parseFloat(parseFloat(kpiRes.rows[0]?.avg_margin || '0').toFixed(2)),
    };

    // Monthly Profit Trend
    const trendRes = await query(`
      SELECT 
        TO_CHAR(cs.created_at, 'Mon YYYY') as month_label,
        EXTRACT(YEAR FROM cs.created_at) as yr,
        EXTRACT(MONTH FROM cs.created_at) as mo,
        COALESCE(SUM(cs.net_profit), 0) as total_profit,
        COALESCE(SUM(cs.total_sale), 0) as total_sale
      FROM cost_sheets cs
      ${whereClause}
      GROUP BY month_label, yr, mo
      ORDER BY yr ASC, mo ASC
      LIMIT 12
    `, params);

    // Salesperson Performance
    const salesRes = await query(`
      SELECT 
        COALESCE(u.name, 'Unassigned') as salesperson_name,
        COALESCE(SUM(cs.total_sale), 0) as total_deal_value,
        COALESCE(SUM(cs.net_profit), 0) as total_profit,
        COUNT(cs.id) as deal_count
      FROM cost_sheets cs
      LEFT JOIN users u ON cs.salesperson_id = u.id
      ${whereClause}
      GROUP BY u.name
      ORDER BY total_deal_value DESC
      LIMIT 10
    `, params);

    // Status Distribution
    const statusRes = await query(`
      SELECT 
        cs.status,
        COUNT(cs.id) as count,
        COALESCE(SUM(cs.total_sale), 0) as total_sale
      FROM cost_sheets cs
      ${whereClause}
      GROUP BY cs.status
    `, params);

    // Recent Cost Sheets
    const recentRes = await query(`
      SELECT cs.id, cs.cs_number, cs.subject, cs.status, cs.current_stage,
             cs.total_sale, cs.net_profit, cs.margin_percentage, cs.created_at,
             acc.name as account_name, u.name as salesperson_name
      FROM cost_sheets cs
      LEFT JOIN accounts acc ON cs.account_id = acc.id
      LEFT JOIN users u ON cs.salesperson_id = u.id
      ${whereClause}
      ORDER BY cs.created_at DESC
      LIMIT 5
    `, params);

    return res.json({
      kpis,
      monthly_trend: trendRes.rows,
      salesperson_performance: salesRes.rows,
      status_distribution: statusRes.rows,
      recent_sheets: recentRes.rows
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
}

export async function exportReportsExcel(req: AuthRequest, res: Response) {
  try {
    const {
      status,
      business_unit,
      salesperson_id,
      month,
      financial_year,
    } = req.query;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let pIndex = 1;

    if (status && status !== 'All') {
      whereClause += ` AND cs.status = $${pIndex++}`;
      params.push(status);
    }
    if (business_unit && business_unit !== 'All') {
      whereClause += ` AND cs.business_unit = $${pIndex++}`;
      params.push(business_unit);
    }
    if (salesperson_id && salesperson_id !== 'All') {
      whereClause += ` AND cs.salesperson_id = $${pIndex++}`;
      params.push(salesperson_id);
    }
    if (month && month !== 'All') {
      whereClause += ` AND EXTRACT(MONTH FROM cs.created_at) = $${pIndex++}`;
      params.push(parseInt(month as string, 10));
    }
    if (financial_year && financial_year !== 'All') {
      whereClause += ` AND cs.cs_number LIKE $${pIndex++}`;
      params.push(`%${financial_year}%`);
    }

    const dataRes = await query(`
      SELECT cs.cs_number, cs.subject, cs.status, cs.current_stage,
             acc.name as account_name,
             u_sale.name as salesperson_name,
             cs.business_unit, cs.oem, cs.distributor, cs.currency,
             cs.total_purchase, cs.discount_type, cs.discount_value,
             cs.consultation_charges, cs.freight_charges,
             cs.net_purchase, cs.total_sale, cs.net_profit, cs.margin_percentage,
             cs.created_at
      FROM cost_sheets cs
      LEFT JOIN accounts acc ON cs.account_id = acc.id
      LEFT JOIN users u_sale ON cs.salesperson_id = u_sale.id
      ${whereClause}
      ORDER BY cs.created_at DESC
    `, params);

    // Format data rows for spreadsheet
    const rows = dataRes.rows.map(item => ({
      'Cost Sheet No': item.cs_number,
      'Deal Subject': item.subject,
      'Customer Account': item.account_name || 'N/A',
      'Salesperson': item.salesperson_name || 'N/A',
      'Status': item.status,
      'Current Stage': item.status === 'Approved' ? 'Completed' : `Stage ${item.current_stage}`,
      'Business Unit': item.business_unit || 'N/A',
      'OEM': item.oem || 'N/A',
      'Distributor': item.distributor || 'N/A',
      'Currency': item.currency,
      'Total Purchase': Number(item.total_purchase),
      'Discount Type': item.discount_type,
      'Discount Value': Number(item.discount_value),
      'Consultation Charges': Number(item.consultation_charges),
      'Freight Charges': Number(item.freight_charges),
      'Net Purchase': Number(item.net_purchase),
      'Total Sale (Deal Value)': Number(item.total_sale),
      'Net Profit': Number(item.net_profit),
      'Margin %': Number(item.margin_percentage),
      'Created Date': new Date(item.created_at).toLocaleDateString('en-GB')
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cost Sheets');

    // Auto column widths
    const max_width = rows.reduce((w, r) => Math.max(w, 20), 10);
    worksheet['!cols'] = Object.keys(rows[0] || {}).map(() => ({ wch: 18 }));

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="SHRO_Cost_Sheets_Report_${Date.now()}.xlsx"`);
    return res.send(buffer);
  } catch (error) {
    console.error('Error exporting Excel report:', error);
    return res.status(500).json({ error: 'Failed to generate Excel report' });
  }
}
