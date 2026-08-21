import AdminResourceManager from '../components/AdminResourceManager';
import apiClient from '../../../../services/apiClient';

const fields = [
  { name: 'user', label: 'Employee', type: 'user', required: true }, { name: 'payPeriod', label: 'Pay Period', type: 'month', required: true }, { name: 'effectiveDate', label: 'Effective Date', type: 'date', required: true },
  { name: 'basicSalary', label: 'Basic Salary', type: 'number', required: true }, { name: 'allowances', label: 'Allowances', type: 'number', defaultValue: 0 }, { name: 'bonus', label: 'Bonus', type: 'number', defaultValue: 0 }, { name: 'incentive', label: 'Incentive', type: 'number', defaultValue: 0 }, { name: 'overtime', label: 'Overtime', type: 'number', defaultValue: 0 }, { name: 'deductions', label: 'Deductions', type: 'number', defaultValue: 0 }, { name: 'salaryAdvance', label: 'Salary Advance', type: 'number', defaultValue: 0 },
  { name: 'status', label: 'Payment Status', type: 'select', options: ['Pending', 'Processing', 'Paid'], defaultValue: 'Pending' }, { name: 'notes', label: 'Notes', type: 'textarea' },
];
const columns = [{ key: 'user', label: 'Employee' }, { key: 'payPeriod', label: 'Pay Period' }, { key: 'gross', label: 'Gross' }, { key: 'totalDeduction', label: 'Total Deduction' }, { key: 'net', label: 'Net Salary' }, { key: 'status', label: 'Status' }];
const transformSubmit = (form) => Object.fromEntries(Object.entries(form).map(([key, value]) => ['basicSalary', 'allowances', 'bonus', 'incentive', 'overtime', 'deductions', 'salaryAdvance'].includes(key) ? [key, Number(value) || 0] : [key, value]));
const payslipAction = (item, _load, setError) => <button type="button" className="action-btn view" onClick={async () => { try { const response = await apiClient.get(`/payroll/${item._id}/payslip`, { responseType: 'text' }); const popup = window.open('', '_blank'); popup.document.write(response.data); popup.document.close(); } catch (error) { setError(error.response?.data?.message || 'Unable to generate payslip'); } }}>Payslip</button>;
export default function Payroll() { return <AdminResourceManager title="Payroll" singular="Payroll Record" endpoint="/payroll" fields={fields} columns={columns} transformSubmit={transformSubmit} extraActions={payslipAction} />; }
