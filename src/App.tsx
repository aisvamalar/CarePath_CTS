import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import SplashScreen from './components/SplashScreen';
import Onboarding from './components/Onboarding';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Appointments from './pages/Appointments';
import CarePlans from './pages/CarePlans';

function AppRoutes() {
  const { state } = useApp();

  if (state.phase === 'splash') return <SplashScreen />;
  if (state.phase === 'onboarding') return <Onboarding />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/chat" element={state.token ? <Chat /> : <Navigate to="/login" replace />} />
        <Route path="/settings" element={state.token ? <Settings /> : <Navigate to="/login" replace />} />
        <Route path="/profile" element={state.token ? <Profile /> : <Navigate to="/login" replace />} />
        <Route path="/appointments" element={state.token ? <Appointments /> : <Navigate to="/login" replace />} />
        <Route path="/care-plans" element={state.token ? <CarePlans /> : <Navigate to="/login" replace />} />
        <Route path="/" element={state.token ? <Navigate to="/chat" replace /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to={state.token ? '/chat' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  );
}
