import { createContext, useEffect, useState } from 'react';
import apiClient from '../services/apiClient';

export const normalizeRole = (value) => String(value || '').trim().toLowerCase();

export const AppContext = createContext({
  user: null,
  token: null,
  loading: false,
  isAuthenticated: false,
  login: async () => {},
  loginAdmin: async () => {},
  loginSuperAdmin: async () => {},
  logout: () => {},
  register: async () => {},
  registerAdmin: async () => {},
  updateCurrentUser: () => {},
  permissions: {},
  permissionsLoading: false,
  can: () => false,
});

export function AppContextProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [permissions, setPermissions] = useState({});
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const loadPermissions = async () => {
    try { const response = await apiClient.get('/auth/me/permissions'); setPermissions(response.data.data?.permissions || {}); }
    catch { setPermissions({}); }
    finally { setPermissionsLoading(false); }
  };

  // Initialize auth state from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('authUser');

    if (storedToken) {
      // Set token header first
      try { apiClient.defaults.headers.common['Authorization'] = 'Bearer ' + storedToken; } catch (e) {}

      // Validate token by calling /auth/me and refresh user data
      apiClient.get('/auth/me')
        .then((resp) => {
          const userData = resp.data.data;
          setUser(userData);
          setToken(storedToken);
          setIsAuthenticated(true);
          loadPermissions();
          localStorage.setItem('authUser', JSON.stringify(userData));
        })
        .catch(() => {
          // Invalid token - clear
          setUser(null);
          setToken(null);
          setIsAuthenticated(false);
          localStorage.removeItem('authToken');
          localStorage.removeItem('authUser');
          try { delete apiClient.defaults.headers.common['Authorization']; } catch (e) {}
        })
        .finally(() => { setLoading(false); if (!storedToken) setPermissionsLoading(false); });
    } else if (storedUser) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
      setLoading(false);
      setPermissionsLoading(false);
    } else {
      setLoading(false);
    }
  }, []);

  const extractErrorMessage = (error, fallback) => {
    if (!error?.response) return 'Unable to connect to server';
    const resp = error?.response?.data;
    if (!resp) return fallback;
    if (typeof resp.message === 'string' && resp.message.length) return resp.message;
    if (Array.isArray(resp.errors) && resp.errors.length) return resp.errors.join(', ');
    return fallback;
  };

  const loginFor = async (email, password, endpoint = '/auth/login') => {
    setLoading(true);
    try {
      const response = await apiClient.post(endpoint, { email, password });
      const { user: userData, token: newToken } = response.data.data;

      setUser(userData);
      setToken(newToken);
      setIsAuthenticated(true);

      localStorage.setItem('authToken', newToken);
      localStorage.setItem('authUser', JSON.stringify(userData));

      apiClient.defaults.headers.common['Authorization'] = 'Bearer ' + newToken;
      setPermissionsLoading(true); await loadPermissions();

      return { success: true, user: userData };
    } catch (error) {
      const message = extractErrorMessage(error, 'Login failed');
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const login = (email, password) => loginFor(email, password);

  const loginAdmin = async (email, password) => {
    const result = await loginFor(email, password, '/auth/admin/login');
    if (!result.success) return result;
    const role = normalizeRole(result.user?.role);
    if (role !== 'admin') {
      logout();
      return { success: false, error: 'This account is not an admin account.' };
    }
    return result;
  };

  const loginSuperAdmin = async (email, password) => {
    const result = await loginFor(email, password, '/auth/super-admin/login');
    if (!result.success) return result;
    const role = normalizeRole(result.user?.role);
    if (role !== 'super_admin') {
      logout();
      return { success: false, error: 'This account is not a super admin account.' };
    }
    return result;
  };

  const registerFor = async (email, password, firstName, lastName, department, phone, designation, endpoint = '/auth/register') => {
    setLoading(true);
    try {
      const response = await apiClient.post(endpoint, { email, password, firstName, lastName, department, phone, designation });
      const payload = response.data.data || {};
      const userData = payload.user || payload;
      const newToken = payload.token || null;

      if (newToken) {
        setUser(userData);
        setToken(newToken);
        setIsAuthenticated(true);
        localStorage.setItem('authToken', newToken);
        localStorage.setItem('authUser', JSON.stringify(userData));
        apiClient.defaults.headers.common['Authorization'] = 'Bearer ' + newToken;
        setPermissionsLoading(true); await loadPermissions();
      }

      return { success: true, user: userData, token: newToken };
    } catch (error) {
      const message = extractErrorMessage(error, 'Registration failed');
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const register = (email, password, firstName, lastName, department, phone, designation) => registerFor(email, password, firstName, lastName, department, phone, designation);

  const registerAdmin = (email, password, firstName, lastName) =>
    registerFor(email, password, firstName, lastName, '', '/auth/admin/register');

  const logout = () => {
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    setPermissions({}); setPermissionsLoading(false);
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    try { delete apiClient.defaults.headers.common['Authorization']; } catch (e) {}
  };

  const updateCurrentUser = (userData) => {
    setUser(userData);
    localStorage.setItem('authUser', JSON.stringify(userData));
  };

  const can = (moduleKey, resourceKey, action = 'view') => user?.role === 'super_admin' || Boolean(permissions?.[moduleKey]?.[resourceKey]?.[action]);
  const value = { user, token, loading, isAuthenticated, permissions, permissionsLoading, can, refreshPermissions: loadPermissions, updateCurrentUser, login, loginAdmin, loginSuperAdmin, logout, register, registerAdmin };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export default AppContext;
