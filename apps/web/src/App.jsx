import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { clearToken, getToken, request } from "./api/client";
import { AppLayout } from "./layouts/AppLayout";
import { AgentsListPage } from "./pages/AgentsListPage";
import {
  ChatRoute,
  EditAgentRoute,
  FilesRoute,
  NewAgentRoute,
  UsersRoute
} from "./pages/AgentRoutes";
import { LoginPage } from "./pages/LoginPage";

// Remember where the visitor was headed so login can send them back.
function RedirectToLogin() {
  const location = useLocation();
  return <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

function RedirectAfterLogin() {
  const location = useLocation();
  return <Navigate to={location.state?.from || "/agents"} replace />;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(getToken()));

  useEffect(() => {
    if (getToken()) {
      request("/api/auth/me").then(setUser).catch(() => {}).finally(() => setChecking(false));
    }
    const expire = () => setUser(null);
    window.addEventListener("auth-expired", expire);
    return () => window.removeEventListener("auth-expired", expire);
  }, []);

  function logout() {
    clearToken();
    setUser(null);
  }

  if (checking) return null;

  return (
    <BrowserRouter>
      {user ? (
        <Routes>
          <Route element={<AppLayout user={user} onLogout={logout} />}>
            <Route path="/agents" element={<AgentsListPage />} />
            <Route path="/agents/new" element={<NewAgentRoute />} />
            <Route path="/agents/:id/edit" element={<EditAgentRoute />} />
            <Route path="/agents/:id/chat" element={<ChatRoute />} />
            <Route path="/agents/:id/files" element={<FilesRoute />} />
            <Route path="/users" element={<UsersRoute />} />
          </Route>
          <Route path="/login" element={<RedirectAfterLogin />} />
          <Route path="*" element={<Navigate to="/agents" replace />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/login" element={<LoginPage onLogin={setUser} />} />
          <Route path="*" element={<RedirectToLogin />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}
