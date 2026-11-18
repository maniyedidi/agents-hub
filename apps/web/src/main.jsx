import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const AVAILABLE_TOOLS = ["list_files", "read_file", "write_file", "search_memory"];
const AVAILABLE_IMAGES = ["node:22-alpine", "python:3.12-slim"];

const emptyAgent = () => ({
  name: "",
  slug: "",
  description: "",
  instructions: "",
  model: { provider: "ollama", name: "" },
  runtime: {
    type: "docker",
    image: AVAILABLE_IMAGES[0],
    memory: 536870912,
    cpus: 1,
    timeout: 300000
  },
  tools: [],
  maxSteps: 10,
  enabled: true
});

async function request(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers
    }
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "The request could not be completed.");
  }

  return result;
}

function AgentForm({ agent, onClose, onSave }) {
  const [values, setValues] = useState(() => agent ? {
    ...emptyAgent(),
    ...agent,
    model: { ...emptyAgent().model, ...agent.model },
    runtime: { ...emptyAgent().runtime, ...agent.runtime }
  } : emptyAgent());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setValues(current => ({ ...current, [field]: value }));
  }

  function updateNested(section, field, value) {
    setValues(current => ({
      ...current,
      [section]: { ...current[section], [field]: value }
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const body = {
      ...values,
      slug: values.slug.trim() || undefined,
      maxSteps: Number(values.maxSteps)
    };

    try {
      await onSave(body);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="agent-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-title"
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">{agent ? "UPDATE CONFIGURATION" : "NEW CONFIGURATION"}</p>
            <h2 id="form-title">{agent ? "Edit agent" : "Create an agent"}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form className="agent-form" onSubmit={submit}>
          <label>
            Name <span className="required">*</span>
            <input
              autoFocus
              required
              value={values.name}
              onChange={event => update("name", event.target.value)}
              placeholder="Code assistant"
            />
          </label>
          <label>
            Slug
            <input
              value={values.slug}
              onChange={event => update("slug", event.target.value)}
              placeholder="Generated from name if left blank"
            />
          </label>
          <label>
            Description
            <input
              value={values.description}
              onChange={event => update("description", event.target.value)}
              placeholder="What this agent is for"
            />
          </label>
          <label>
            Model name <span className="required">*</span>
            <input
              required
              value={values.model.name}
              onChange={event => updateNested("model", "name", event.target.value)}
              placeholder="llama3.2"
            />
          </label>
          <label>
            Instructions <span className="required">*</span>
            <textarea
              required
              rows="5"
              value={values.instructions}
              onChange={event => update("instructions", event.target.value)}
              placeholder="Describe how the agent should work"
            />
          </label>

          <div className="form-grid">
            <label>
              Runtime image
              <select
                value={values.runtime.image}
                onChange={event => updateNested("runtime", "image", event.target.value)}
              >
                {AVAILABLE_IMAGES.map(image => <option key={image}>{image}</option>)}
              </select>
            </label>
            <label>
              Max steps
              <input
                type="number"
                min="1"
                value={values.maxSteps}
                onChange={event => update("maxSteps", event.target.value)}
              />
            </label>
          </div>

          <fieldset>
            <legend>Tools</legend>
            <div className="tool-options">
              {AVAILABLE_TOOLS.map(tool => (
                <label className="check-label" key={tool}>
                  <input
                    type="checkbox"
                    checked={values.tools.includes(tool)}
                    onChange={event => update(
                      "tools",
                      event.target.checked
                        ? [...values.tools, tool]
                        : values.tools.filter(selected => selected !== tool)
                    )}
                  />
                  <code>{tool}</code>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="check-label enabled-option">
            <input
              type="checkbox"
              checked={values.enabled}
              onChange={event => update("enabled", event.target.checked)}
            />
            Agent is enabled
          </label>

          {error && <p className="inline-error" role="alert">{error}</p>}

          <div className="form-actions">
            <button className="button button-quiet" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="button button-primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : agent ? "Save changes" : "Create agent"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function App() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

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
          <div className="user-avatar" aria-label="Workspace">W</div>
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
                              onClick={() => setEditing(agent)}
                            >Edit</button>
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
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
