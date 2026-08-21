import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import routeConfig from './routeConfig.js';

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {routeConfig.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={
              route.layout ? (
                <route.layout>{<route.component />}</route.layout>
              ) : (
                <route.component />
              )
            }
          />
        ))}
        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
