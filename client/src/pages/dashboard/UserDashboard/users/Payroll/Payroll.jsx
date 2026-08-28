import ResourceModule from '../components/ResourceModule';
import apiClient from '../../../../../services/apiClient';

const money = v => v == null ? '-' : Number(v).toLocaleString();

const downloadPayslip = async (record) => {
  try {
    const response = await apiClient.get(`/payroll/${record._id}/payslip`, { responseType: 'text' });
    const popup = window.open('', '_blank');
    popup.document.write(response.data);
    popup.document.close();
  } catch (error) {
    alert(error.response?.data?.message || 'Unable to generate payslip');
  }
};

const config = {
  singular: 'Payroll Record',
  plural: 'Payroll',
  endpoint: '/payroll',
  basePath: '/user/payroll',
  canCreate: false,
  canEdit: false,
  fields: [
    { name: 'month', label: 'Month' },
    { name: 'gross', label: 'Gross' },
    { name: 'deductions', label: 'Deductions' },
    { name: 'net', label: 'Net' },
    { name: 'currency', label: 'Currency' },
    { name: 'status', label: 'Status' },
    { name: 'notes', label: 'Notes' }
  ],
  columns: [], // Using renderCard instead
  renderEmptyState: () => (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '48px', height: '48px', marginBottom: '1rem', color: '#94a3b8', margin: '0 auto' }}><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M12 12h.01" /><path d="M17 12h.01" /><path d="M7 12h.01" /></svg>
      <h3 style={{ margin: '0 0 0.5rem', color: '#0f172a', fontSize: '1.25rem' }}>No Payroll Records Found</h3>
      <p style={{ margin: 0, fontSize: '0.9rem' }}>Your payroll information will appear here once processed by HR.</p>
    </div>
  ),
  renderCard: (record, onClick) => (
    <div key={record._id} style={{ border: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '16px', padding: '1.1rem', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.8rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.8rem', marginBottom: '0.8rem' }}>
        <div>
          <h4 style={{ margin: '0 0 0.2rem', color: '#0f172a', fontSize: '1.1rem' }}>{record.payPeriod || record.month || 'Payslip'}</h4>
          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{new Date(record.effectiveDate || record.createdAt).toLocaleDateString()}</span>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.3rem 0.6rem', borderRadius: '999px', background: record.status === 'Paid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: record.status === 'Paid' ? '#059669' : '#b45309', fontSize: '0.75rem', fontWeight: 'bold' }}>{record.status}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.4rem' }}>
        <span style={{ color: '#64748b' }}>Gross Pay</span>
        <strong style={{ color: '#0f172a' }}>{money(record.basicSalary || record.gross)} {record.currency || 'INR'}</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.8rem' }}>
        <span style={{ color: '#64748b' }}>Deductions</span>
        <strong style={{ color: '#ef4444' }}>- {money(record.deductions)} {record.currency || 'INR'}</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', marginTop: '0.4rem', borderTop: '1px dashed #cbd5e1', paddingTop: '0.8rem' }}>
        <span style={{ color: '#0f172a', fontWeight: 'bold' }}>Net Pay</span>
        <strong style={{ color: '#059669' }}>{money(record.net)} {record.currency || 'INR'}</strong>
      </div>
      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
        <button onClick={() => downloadPayslip(record)} style={{ flex: 1, padding: '0.6rem', background: '#e75914', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>View Payslip</button>
      </div>
    </div>
  )
};

export default function Payroll() { return <ResourceModule config={config} />; }
