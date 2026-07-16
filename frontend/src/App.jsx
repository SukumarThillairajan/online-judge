import { Routes, Route, Navigate } from 'react-router-dom';

// Features
import Login from "./features/auth/pages/Login.jsx";
import Register from "./features/auth/pages/Register.jsx";
import Dashboard from "./features/problems/pages/Dashboard.jsx";
import Arena from "./features/problems/pages/Arena.jsx";
import SubmissionsPage from "./features/submissions/pages/SubmissionsPage.jsx";

// Components
import ProtectedRoute from "./features/auth/components/ProtectedRoute.jsx";

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/problems/:id" element={<Arena />} />
        <Route path="/problems/:id/submissions" element={<SubmissionsPage />} />
      </Route>

      {/* Catch-all route to redirect to dashboard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;