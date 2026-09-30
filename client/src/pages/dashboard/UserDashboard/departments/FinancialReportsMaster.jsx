import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../../../services/apiClient';

const REPORT_TYPES = [
  { id: 'income_collections', label: '1. Income & Collections Report', icon: '💰' },
  { id: 'invoice_receivables', label: '2. Invoice Status & Receivables', icon: '📄' },
  { id: 'receivables_aging', label: '3. Receivables Aging Report', icon: '⏳' },
  { id: 'expenses', label: '4. Expense Breakdown Report', icon: '🧾' },
  { id: 'vendor_bills', label: '5. Vendor Bills & Payments', icon: '🏢' },
  { id: 'payables_aging', label: '6. Payables Aging Report', icon: '📉' },
  { id: 'payroll_salary', label: '7. Payroll & Salary Payouts', icon: '💼' },
  { id: 'salary_advances', label: '8. Salary Advances & Recoveries', icon: '💸' },
  { id: 'bank_transactions', label: '9. Bank Account Transactions', icon: '🏦' },
  { id: 'cash_flow', label: '10. Cash Flow & Runway', icon: '📈' },
  { id: 'ledger', label: '11. Double-Entry General Ledger', icon: '📖' },
  { id: 'reconciliation', label: '12. Bank Reconciliation Status', icon: '⚖️' },
  { id: 'client_financial_summary', label: '13. Client Financial Master Summary', icon: '👥' },
  { id: 'vendor_financial_summary', label: '14. Vendor Financial Summary', icon: '🤝' },
];

export default function FinancialReportsMaster({
  formatCurrency,
  formatDate,
  user,
}) {
  const [selectedReport, setSelectedReport] = useState('income_collections');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [reportResult, setReportResult] = useState(null);

  const fetchReport = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      let url = `/finance/reports?reportType=${selectedReport}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      const res = await apiClient.get(url);
      setReportResult(res.data?.data || null);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to generate financial report');
      setReportResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedReport, startDate, endDate]);

  // Quick Preset Date Filters
  const applyPreset = (preset) => {
    const now = new Date();
    if (preset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(start.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    } else if (preset === 'quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), qMonth, 1);
      setStartDate(start.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    } else if (preset === 'year') {
      const start = new Date(now.getFullYear(), 0, 1);
      setStartDate(start.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Filtered rows for in-table searching
  const filteredData = useMemo(() => {
    if (!reportResult?.data || !Array.isArray(reportResult.data)) return [];
    if (!searchTerm.trim()) return reportResult.data;
    const q = searchTerm.toLowerCase();
    return reportResult.data.filter((row) => {
      return Object.values(row).some((val) =>
        String(val || '').toLowerCase().includes(q)
      );
    });
  }, [reportResult, searchTerm]);

  // CSV Export
  const exportCSV = () => {
    if (!filteredData.length || !reportResult?.columns?.length) {
      return alert('No data to export');
    }
    const cols = reportResult.columns;
    const headerLine = cols.map((c) => `"${c.label}"`).join(',');
    const dataLines = filteredData.map((row) =>
      cols
        .map((c) => {
          let val = row[c.key];
          if (val === undefined || val === null) val = '';
          if (c.key.toLowerCase().includes('date')) val = formatDate(val);
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(',')
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [headerLine, ...dataLines].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${selectedReport}_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fin-reports-master">
      {/* Top Controls Bar */}
      <div className="fin-reports-controls">
        <div className="fin-report-select-group">
          <label htmlFor="fin-report-type-select" className="fin-report-label">Select Report:</label>
          <select
            id="fin-report-type-select"
            value={selectedReport}
            onChange={(e) => setSelectedReport(e.target.value)}
            className="fin-report-select"
          >
            {REPORT_TYPES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.icon} {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className="fin-report-date-group">
          <button type="button" className="fin-period-btn small" onClick={() => applyPreset('month')}>This Month</button>
          <button type="button" className="fin-period-btn small" onClick={() => applyPreset('quarter')}>Quarter</button>
          <button type="button" className="fin-period-btn small" onClick={() => applyPreset('year')}>Year</button>
          <button type="button" className="fin-period-btn small" onClick={() => applyPreset('all')}>All Time</button>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="fin-date-input"
            title="Start Date"
          />
          <span className="fin-cell-sub">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="fin-date-input"
            title="End Date"
          />
        </div>

        <div className="fin-report-action-group">
          <button type="button" className="fin-action-btn secondary" onClick={exportCSV}>
            📥 Export CSV
          </button>
          <button type="button" className="fin-action-btn" onClick={handlePrint}>
            🖨️ Print
          </button>
          <button type="button" className="fin-action-btn primary" onClick={fetchReport} disabled={loading}>
            {loading ? 'Refreshing...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {errorMsg && <div className="fin-alert error">{errorMsg}</div>}

      {/* Summary KPI Cards for Current Report */}
      {reportResult?.summary && (
        <div className="fin-report-summary-cards">
          {Object.entries(reportResult.summary).map(([key, val]) => {
            const isAmount =
              typeof val === 'number' &&
              (key.toLowerCase().includes('total') ||
                key.toLowerCase().includes('amount') ||
                key.toLowerCase().includes('collected') ||
                key.toLowerCase().includes('balance') ||
                key.toLowerCase().includes('credit') ||
                key.toLowerCase().includes('debit') ||
                key.toLowerCase().includes('flow') ||
                key.toLowerCase().includes('outflow') ||
                key.toLowerCase().includes('inflow') ||
                key.toLowerCase().includes('net') ||
                key.toLowerCase().includes('outstanding') ||
                key.toLowerCase().includes('disbursed'));

            const formattedKey = key
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, (str) => str.toUpperCase());

            return (
              <div key={key} className="fin-report-kpi-card">
                <span className="fin-report-kpi-label">{formattedKey}</span>
                <span className="fin-report-kpi-val">
                  {isAmount ? formatCurrency(val) : String(val)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Table Toolbar */}
      <div className="fin-table-toolbar">
        <input
          type="text"
          placeholder="Filter rows by keyword, client, status, amount..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="fin-search-input"
        />
        <span className="fin-toolbar-count">
          Showing <strong>{filteredData.length}</strong> records
          {reportResult?.generatedAt && (
            <span className="fin-cell-sub" style={{ marginLeft: '8px' }}>
              • Generated {new Date(reportResult.generatedAt).toLocaleTimeString()}
            </span>
          )}
        </span>
      </div>

      {/* Report Table */}
      <div className="fin-responsive-table-wrapper">
        <table className="fin-table">
          <thead>
            <tr>
              {reportResult?.columns?.map((col) => (
                <th
                  key={col.key}
                  style={{ textAlign: col.align || 'left' }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={reportResult?.columns?.length || 6}
                  className="fin-empty-cell"
                >
                  Generating real-time financial report from database...
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan={reportResult?.columns?.length || 6}
                  className="fin-empty-cell"
                >
                  No records found for the selected report filters
                </td>
              </tr>
            ) : (
              filteredData.map((row, idx) => (
                <tr key={idx}>
                  {reportResult.columns.map((col) => {
                    const val = row[col.key];
                    const isCurrency =
                      col.align === 'right' ||
                      col.label.includes('₹') ||
                      col.key.toLowerCase().includes('amount') ||
                      col.key.toLowerCase().includes('total') ||
                      col.key.toLowerCase().includes('balance') ||
                      col.key.toLowerCase().includes('paid') ||
                      col.key.toLowerCase().includes('credit') ||
                      col.key.toLowerCase().includes('debit') ||
                      col.key.toLowerCase().includes('net') ||
                      col.key.toLowerCase().includes('basic') ||
                      col.key.toLowerCase().includes('allowances') ||
                      col.key.toLowerCase().includes('deductions');

                    const isDate =
                      col.key.toLowerCase().includes('date') ||
                      col.key === 'createdAt';

                    return (
                      <td
                        key={col.key}
                        style={{ textAlign: col.align || 'left' }}
                      >
                        {isCurrency ? (
                          <span style={{ fontWeight: col.key.includes('total') || col.key.includes('balance') ? '700' : '500' }}>
                            {formatCurrency(val)}
                          </span>
                        ) : isDate ? (
                          formatDate(val)
                        ) : col.key === 'status' || col.key === 'recoveryStatus' ? (
                          <span
                            className={`fin-badge ${
                              val === 'Paid' || val === 'Settled' || val === 'Completed' || val === 'Clear' || val === 'Active'
                                ? 'success'
                                : val === 'Pending' || val === 'Draft' || val === 'Outstanding' || val === 'Payable'
                                ? 'warning'
                                : val === 'Cancelled' || val === 'Overdue' || val === 'Rejected'
                                ? 'danger'
                                : 'neutral'
                            }`}
                          >
                            {val || '—'}
                          </span>
                        ) : (
                          String(val !== undefined && val !== null ? val : '—')
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
