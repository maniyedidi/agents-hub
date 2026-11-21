import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { request } from "../api/client";

function breadcrumb(pathname) {
  if (pathname === "/users") return "Users";
  if (pathname === "/agents/new") return "New agent";
  if (pathname.endsWith("/edit")) return "Edit agent";
  if (pathname.endsWith("/chat")) return "Chat";
  if (pathname.endsWith("/files")) return "Files";
  return null;
}

export function AppLayout({ user, onLogout }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const current = breadcrumb(pathname);

  async function loadAgents() {
    setError("");
    try {
      setAgents(await request("/api/agents"));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAgents();
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink className="brand" to="/agents" aria-label="Agents Hub home">
          <img className="brand-mark" src="/favicon.svg" alt="" />
          <span>agents<span className="brand-light">hub</span></span>
        </NavLink>
        <div className="nav-section">WORKSPACE</div>
        <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/agents">
          <span className="nav-icon">◈</span> Agents
          <span className="nav-count">{agents.length}</span>
        </NavLink>
        {user.role === "admin" && (
          <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/users">
            <span className="nav-icon">◉</span> Users
          </NavLink>
        )}
        <div className="sidebar-footer">
          <span className="connection-dot" />
          API connected
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <span className="breadcrumb">
            Workspace <span>/</span> Agents
            {current && <> <span>/</span> {current}</>}
          </span>
          <div>
            <span className="breadcrumb">{user.name} ({user.role})</span>{" "}
            <button className="button" onClick={onLogout}>Sign out</button>
          </div>
        </header>

        <Outlet context={{ agents, setAgents, loading, error, setError, user, reloadAgents: loadAgents }} />
      </main>
    </div>
  );
}
