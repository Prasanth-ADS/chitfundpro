import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { Login } from "./pages/Login";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { Dashboard } from "./pages/Dashboard";
import { Schemes } from "./pages/Schemes";
import { Pools } from "./pages/Pools";
import { PoolDetail } from "./pages/PoolDetail";
import { Reports } from "./pages/Reports";
import { Settings } from "./pages/Settings";
import { Members } from "./pages/Members";
import { MemberDetail } from "./pages/MemberDetail";
import { Payments } from "./pages/Payments";



export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/members" element={<Members />} />
            <Route path="/members/:id" element={<MemberDetail />} />
            <Route path="/pools" element={<Pools />} />
            <Route path="/pools/:id" element={<PoolDetail />} />
            <Route path="/schemes" element={<Schemes />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
