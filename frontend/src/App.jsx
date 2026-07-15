import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Login from "./features/auth/pages/Login.jsx";
import Register from "./features/auth/pages/Register.jsx";
import Dashboard from "./features/problems/pages/Dashboard.jsx";
import Arena from "./features/problems/pages/Arena.jsx";
import SubmissionsPage from "./features/submissions/pages/SubmissionsPage.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/problems/:id" element={<Arena />} />
        <Route path="/problems/:id/submissions" element={<SubmissionsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;