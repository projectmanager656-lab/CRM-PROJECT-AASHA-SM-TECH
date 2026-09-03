export const getDashboardRoute = (user) => {
  if (!user) return '/login';

  const role = String(user.role || '').trim().toLowerCase();

  // 1. Role Priority
  if (role === 'super_admin') {
    return '/super-admin/dashboard';
  }

  if (role === 'admin') {
    return '/admin/dashboard';
  }

  // 2. User/Employee Department Routing
  if (role === 'employee' || role === 'user') {
    const dept = String(user.department || '').trim().toLowerCase();

    switch (dept) {
      case 'hr':
        return '/dashboard/hr';
      case 'finance':
        return '/dashboard/finance';
      case 'business development':
      case 'sales': // Sales is handled under Business Development
        return '/dashboard/business-development';
      case 'digital marketing':
        return '/dashboard/digital-marketing';
      case 'video editor':
        return '/dashboard/video-editor';
      case 'tech':
        return '/user';
      default:
        // Fallback for unassigned or missing department
        return '/user';
    }
  }

  // Catch-all fallback
  return '/user';
};
