import { useState } from "react";
import { AVAILABLE_IMAGES, AVAILABLE_TOOLS, emptyAgent } from "../constants";

export function AgentForm({ agent, onClose, onSave }) {
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
    <section className="page-content">
      <section
        className="page-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-title"
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">{agent ? "UPDATE CONFIGURATION" : "NEW CONFIGURATION"}</p>
            <h2 id="form-title">{agent ? "Edit agent" : "Create an agent"}</h2>
          </div>
          <button className="button" type="button" onClick={onClose}>← Back</button>
        </div>

        <form className="agent-form" onSubmit={submit}>
          <label>
            <span>Name <span className="required">*</span></span>
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
            <span>Model name <span className="required">*</span></span>
            <input
              required
              value={values.model.name}
              onChange={event => updateNested("model", "name", event.target.value)}
              placeholder="llama3.2"
            />
          </label>
          <label>
            <span>Instructions <span className="required">*</span></span>
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

          {values.tools.includes("mongo_find") && (
            <label>
              Allowed DB collections (comma separated)
              <input
                value={(values.dbCollections || []).join(", ")}
                onChange={event => update(
                  "dbCollections",
                  event.target.value.split(",").map(item => item.trim()).filter(Boolean)
                )}
                placeholder="orders, customers"
              />
            </label>
          )}

          {values.tools.includes("mcp") && (
            <fieldset className="mcp-section">
              <legend>MCP servers (remote HTTP)</legend>
              {(values.mcpServers || []).length === 0 && (
                <p className="mcp-empty">No MCP servers yet. Add one to let this agent call its tools.</p>
              )}
              {(values.mcpServers || []).map((server, index) => {
                const setField = (field, value) => update("mcpServers", values.mcpServers.map((item, i) =>
                  i === index ? { ...item, [field]: value } : item));
                return (
                  <div className="mcp-card" key={index}>
                    <div className="mcp-card-header">
                      <strong>Server {index + 1}</strong>
                      <button
                        type="button"
                        className="button button-small button-danger"
                        onClick={() => update("mcpServers", values.mcpServers.filter((_, i) => i !== index))}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="form-grid">
                      <label>
                        Name
                        <input
                          placeholder="docs"
                          value={server.name}
                          onChange={event => setField("name", event.target.value)}
                        />
                      </label>
                      <label>
                        <span>Bearer token <span className="optional">(optional)</span></span>
                        <input
                          type="password"
                          autoComplete="off"
                          placeholder="••••••••"
                          value={server.authToken || ""}
                          onChange={event => setField("authToken", event.target.value)}
                        />
                      </label>
                    </div>
                    <label className="mcp-url">
                      URL
                      <input
                        placeholder="https://host/mcp"
                        value={server.url}
                        onChange={event => setField("url", event.target.value)}
                      />
                    </label>
                  </div>
                );
              })}
              <button
                type="button"
                className="button button-small"
                onClick={() => update("mcpServers", [...(values.mcpServers || []), { name: "", url: "", authToken: "" }])}
              >
                + Add MCP server
              </button>
            </fieldset>
          )}

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
    </section>
  );
}
