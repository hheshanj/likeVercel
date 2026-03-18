import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import VpsDetail from './pages/VpsDetail';
import Settings from './pages/Settings';
import AddVps from './pages/AddVps';
import EditVps from './pages/EditVps';
import Layout from './components/Layout/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-bg-primary text-text-primary font-bold uppercase tracking-widest text-xs">
      Initializing Security Protocol...
    </div>
  );
  
  return user ? <Layout>{children}</Layout> : <Navigate to="/login" />;
};

const App: React.FC = () => {
  useEffect(() => {
    // Ensure the app stays in light theme
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('vps-deploy-theme', 'light');
  }, []);

  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route 
          path="/dashboard" 
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/vps/add" 
          element={
            <PrivateRoute>
              <AddVps />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/vps/:id" 
          element={
            <PrivateRoute>
              <VpsDetail />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/vps/:id/edit" 
          element={
            <PrivateRoute>
              <EditVps />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/settings" 
          element={
            <PrivateRoute>
              <Settings />
            </PrivateRoute>
          } 
        />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </AuthProvider>
  );
};

export default App;
