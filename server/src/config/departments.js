// Employee departments. Project category is deliberately kept separate.
export const SUPPORTED_DEPARTMENTS = ['HR', 'Sales', 'Business Development', 'Finance', 'Tech', 'Non-Tech'];
export const NON_TECH_LEAD_DEPARTMENTS = ['HR', 'Sales', 'Business Development', 'Finance', 'Non-Tech'];
export const isSupportedDepartment = (value) => SUPPORTED_DEPARTMENTS.includes(String(value || '').trim());
