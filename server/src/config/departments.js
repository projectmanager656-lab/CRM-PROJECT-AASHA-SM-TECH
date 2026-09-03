// Official company departments
export const SUPPORTED_DEPARTMENTS = [
  'HR',
  'Finance',
  'Business Development',
  'Digital Marketing',
  'Video Editor',
  'Tech',
];
export const NON_TECH_LEAD_DEPARTMENTS = [
  'HR',
  'Finance',
  'Business Development',
  'Digital Marketing',
  'Video Editor',
];
export const isSupportedDepartment = (value) => SUPPORTED_DEPARTMENTS.includes(String(value || '').trim());
