import { useEffect, useState } from "react";
import { clearToken, getToken, request } from "./api/client";
import { AgentsPage } from "./pages/AgentsPage";
import { LoginPage } from "./pages/LoginPage";

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
  return user ? <AgentsPage user={user} onLogout={logout} /> : <LoginPage onLogin={setUser} />;
}
