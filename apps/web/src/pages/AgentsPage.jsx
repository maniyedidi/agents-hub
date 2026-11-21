import { useEffect, useMemo, useState } from "react";
import { request } from "../api/client";
import { AgentForm } from "../components/AgentForm";
import { MemoryModal } from "../components/MemoryModal";
import { ChatModal } from "../components/ChatModal";
import { UsersModal } from "../components/UsersModal";

export function AgentsPage({ user, onLogout }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [memoryAgent, setMemoryAgent] = useState(null);
  const [showUsers, setShowUsers] = useState(false);
  const [chatAgent, setChatAgent] = useState(null);

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

  const filteredAgents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return agents;
    return agents.filter(agent =>
      [agent.name, agent.slug, agent.description, agent.model?.name]
        .some(value => value?.toLowerCase().includes(normalizedQuery))
    );
  }, [agents, query]);

  async function saveAgent(values) {
    const isEditing = Boolean(editing);
    await request(isEditing ? `/api/agents/${editing._id}` : "/api/agents", {
      method: isEditing ? "PUT" : "POST",
      body: JSON.stringify(values)
    });
    setCreating(false);
    setEditing(null);
    await loadAgents();
  }

  async function deleteAgent(agent) {
    if (!window.confirm(`Delete "${agent.name}"? This cannot be undone.`)) return;
    try {
      await request(`/api/agents/${agent._id}`, { method: "DELETE" });
      setAgents(current => current.filter(item => item._id !== agent._id));
      setError("");
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  const enabledCount = agents.filter(agent => agent.enabled).length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Agents Hub home">
          <span className="brand-mark">A</span>
          <span>agents<span className="brand-light">hub</span></span>
        </a>
        <div className="nav-section">WORKSPACE</div>
        <a className="nav-link active" href="#agents">
          <span className="nav-icon">◈</span> Agents
          <span className="nav-count">{agents.length}</span>
        </a>
        <div className="sidebar-footer">
          <span className="connection-dot" />
          API connected
        </div>
      </aside>

      <main className="main-content" id="agents">
        <header className="topbar">
          <span className="breadcrumb">Workspace <span>/</span> Agents</span>
          <div>
            <span className="breadcrumb">{user.name} ({user.role})</span>{" "}
            {user.role === "admin" && (
              <button className="button" onClick={() => setShowUsers(true)}>Users</button>
            )}{" "}
            <button className="button" onClick={onLogout}>Sign out</button>
          </div>
        </header>

        <section className="page-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">WORKSPACE</p>
              <h1>Agents</h1>
              <p className="subtitle">Create and manage the agents available in your workspace.</p>
            </div>
            <button className="button button-primary" onClick={() => setCreating(true)}>
              <span className="plus">+</span> New agent
            </button>
          </div>

          <div className="summary-grid">
            <article className="summary-card">
              <span className="summary-label">TOTAL AGENTS</span>
              <strong>{agents.length}</strong>
              <span className="summary-note">Configured in this workspace</span>
            </article>
            <article className="summary-card">
              <span className="summary-label">ENABLED</span>
              <strong>{enabledCount}</strong>
              <span className="summary-note">Ready to accept tasks</span>
            </article>
          </div>

          <section className="agents-panel">
            <div className="panel-heading">
              <div>
                <h2>All agents <span className="count-pill">{filteredAgents.length}</span></h2>
                <p>Manage your agent configurations and runtime settings.</p>
              </div>
              <label className="search-field">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  placeholder="Search agents..."
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  aria-label="Search agents"
                />
              </label>
            </div>

            {error && (
              <div className="error-banner" role="alert">
                <span>{error}</span>
                <button className="text-button" onClick={loadAgents}>Try again</button>
              </div>
            )}

            {loading ? (
              <div className="empty-state">Loading agents…</div>
            ) : filteredAgents.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">◈</div>
                <h3>{query ? "No matching agents" : "No agents yet"}</h3>
                <p>{query
                  ? "Try a different search term."
                  : "Create your first agent to get started."}</p>
                {!query && (
                  <button className="button button-primary" onClick={() => setCreating(true)}>
                    Create an agent
                  </button>
                )}
              </div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>AGENT</th>
                      <th>MODEL</th>
                      <th>TOOLS</th>
                      <th>STATUS</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAgents.map(agent => (
                      <tr key={agent._id}>
                        <td>
                          <div className="agent-name-cell">
                            <span className="agent-avatar">{agent.name.slice(0, 1).toUpperCase()}</span>
                            <span>
                              <strong>{agent.name}</strong>
                              <small>{agent.slug}</small>
                            </span>
                          </div>
                        </td>
                        <td><span className="model-tag">{agent.model?.name || "—"}</span></td>
                        <td>
                          <span className="tool-count">
                            {Array.isArray(agent.tools) ? agent.tools.length : 0} tools
                          </span>
                        </td>
                        <td>
                          <span className={`status ${agent.enabled ? "status-enabled" : "status-disabled"}`}>
                            <span />{agent.enabled ? "Enabled" : "Disabled"}
                          </span>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="button button-small"
                              onClick={() => setChatAgent(agent)}
                            >Chat</button>
                            <button
                              className="button button-small"
                              onClick={() => setEditing(agent)}
                            >Edit</button>
                             <button
                              className="button button-small"
                              onClick={() => setMemoryAgent(agent)}
                            >Files</button>
                            <button
                              className="button button-small button-danger"
                              onClick={() => deleteAgent(agent)}
                            >Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <footer className="page-footer">Agents Hub <span>·</span> Agent workspace</footer>
        </section>
      </main>

      {(creating || editing) && (
        <AgentForm
          agent={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={saveAgent}
        />
      )}
      {showUsers && (
        <UsersModal currentUser={user} onClose={() => setShowUsers(false)} />
      )}
      {memoryAgent && (
        <MemoryModal agent={memoryAgent} onClose={() => setMemoryAgent(null)} />
      )}
      {chatAgent && (
        <ChatModal agent={chatAgent} onClose={() => setChatAgent(null)} />
      )}
    </div>
  );
}
