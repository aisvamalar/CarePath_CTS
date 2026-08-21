import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { ToastProvider } from './components/ui/Toast';
import SplashScreen from './components/SplashScreen';
import Onboarding from './components/Onboarding';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Appointments from './pages/Appointments';
import CarePlans from './pages/CarePlans';

// Care Manager pages
import CareManagerDashboard from './pages/care_manager/Dashboard';
import CareManagerProfile from './pages/care_manager/Profile';
import CareManagerPatients from './pages/care_manager/Patients';
import CareManagerPatientDetail from './pages/care_manager/PatientDetail';
import CareManagerReadmission from './pages/care_manager/Readmission';
import CareManagerPostDischarge from './pages/care_manager/PostDischarge';
import CareManagerCreatePatient from './pages/care_manager/CreatePatient';

function AppRoutes() {
  const { state } = useApp();

  if (state.phase === 'splash') return <SplashScreen />;
  if (state.phase === 'onboarding') return <Onboarding />;

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Patient routes */}
        <Route path="/chat" element={state.token ? <Chat /> : <Navigate to="/login" replace />} />
        <Route path="/settings" element={state.token ? <Settings /> : <Navigate to="/login" replace />} />
        <Route path="/profile" element={state.token ? <Profile /> : <Navigate to="/login" replace />} />
        <Route path="/appointments" element={state.token ? <Appointments /> : <Navigate to="/login" replace />} />
        <Route path="/care-plans" element={state.token ? <CarePlans /> : <Navigate to="/login" replace />} />

        {/* Care Manager routes */}
        <Route path="/care-manager" element={state.token ? <CareManagerDashboard /> : <Navigate to="/login" replace />} />
        <Route path="/care-manager/profile" element={state.token ? <CareManagerProfile /> : <Navigate to="/login" replace />} />
        <Route path="/care-manager/patients" element={state.token ? <CareManagerPatients /> : <Navigate to="/login" replace />} />
        <Route path="/care-manager/patients/new" element={state.token ? <CareManagerCreatePatient /> : <Navigate to="/login" replace />} />
        <Route path="/care-manager/patients/:id" element={state.token ? <CareManagerPatientDetail /> : <Navigate to="/login" replace />} />
        <Route path="/care-manager/readmission" element={state.token ? <CareManagerReadmission /> : <Navigate to="/login" replace />} />
        <Route path="/care-manager/post-discharge" element={state.token ? <CareManagerPostDischarge /> : <Navigate to="/login" replace />} />
        <Route path="/care-manager/analytics" element={state.token ? <CareManagerReadmission /> : <Navigate to="/login" replace />} />

        {/* Default redirects */}
        <Route path="/" element={state.token ? <Navigate to="/chat" replace /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to={state.token ? '/chat' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AppProvider>
  );
}
