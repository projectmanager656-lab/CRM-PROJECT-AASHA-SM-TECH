import { useContext } from 'react';
import { AppContext } from '../context/AppContext';

export function useAuth() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useAuth must be used within AppContextProvider');
  }

  return {
    user: context.user,
    token: context.token,
    isAuthenticated: context.isAuthenticated,
    loading: context.loading,
    login: context.login,
    logout: context.logout,
    register: context.register,
  };
}

export default useAuth;
