import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import VpsDetail from './pages/VpsDetail';
import Settings from './pages/Settings';
import AddVps from './pages/AddVps';
import EditVps from './pages/EditVps';
import KeyManager from './pages/KeyManager';
import Layout from './components/Layout/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-bg-primary text-text-primary font-bold uppercase tracking-widest text-xs">
      Initializing Security Protocol...
    </div>
  );
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <Layout>{children}</Layout>;
};

const AuthRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-bg-primary text-text-primary font-bold uppercase tracking-widest text-xs">
      Initializing Security Protocol...
    </div>
  );
  
  if (user) return <Navigate to="/dashboard" replace />;
  
  
  return <>{children}</>;
};

const App: React.FC = () => {

  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
      <Routes>
        <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
        <Route path="/register" element={<AuthRoute><Register /></AuthRoute>} />
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
        <Route 
          path="/keys" 
          element={
            <PrivateRoute>
              <KeyManager />
            </PrivateRoute>
          } 
        />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
      </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default App;
