import { useEffect, useState } from "react";
import { request } from "../api/client";

export function UsersModal({ currentUser, onClose }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setUsers(await request("/api/users"));
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function act(action) {
    setError("");
    setBusy(true);
    try {
      await action();
      await load();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusy(false);
    }
  }

  const patch = (user, body) => act(() => request(`/api/users/${user._id}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  }));

  function register(event) {
    event.preventDefault();
    act(async () => {
      await request("/api/users", { method: "POST", body: JSON.stringify(form) });
      setForm({ name: "", email: "", password: "", role: "user" });
    });
  }

  function resetPassword(user) {
    const password = window.prompt(`New password for ${user.email} (min 8 characters):`);
    if (password) patch(user, { password });
  }

  function remove(user) {
    if (window.confirm(`Delete ${user.email}?`)) {
      act(() => request(`/api/users/${user._id}`, { method: "DELETE" }));
    }
  }

  return (
    <section className="page-content">
      <section className="page-card" aria-labelledby="users-title">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">ADMINISTRATION</p>
            <h2 id="users-title">Users</h2>
          </div>
          <button className="button" type="button" onClick={onClose}>← Back</button>
        </div>

        <form className="agent-form" onSubmit={register}>
          <div className="form-grid">
            <input required placeholder="Name" value={form.name}
              onChange={event => setForm({ ...form, name: event.target.value })} />
            <input required type="email" placeholder="Email" value={form.email}
              onChange={event => setForm({ ...form, email: event.target.value })} />
            <input required type="password" minLength={8} placeholder="Password (min 8)" value={form.password}
              onChange={event => setForm({ ...form, password: event.target.value })} />
            <select value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <button className="button button-primary" disabled={busy}>Register user</button>
        </form>

        {error && <p className="inline-error" role="alert">{error}</p>}

        <div style={{ marginTop: 16, overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 13 }}>
            <tbody>
              {users.map(user => {
                const self = user._id === currentUser._id;
                return (
                  <tr key={user._id}>
                    <td>{user.name}<br /><small>{user.email}</small></td>
                    <td>
                      <select value={user.role} disabled={busy || self}
                        onChange={event => patch(user, { role: event.target.value })}>
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td>
                      <button className="button button-small" disabled={busy || self}
                        onClick={() => patch(user, { active: !user.active })}>
                        {user.active ? "Deactivate" : "Activate"}
                      </button>{" "}
                      <button className="button button-small" disabled={busy}
                        onClick={() => resetPassword(user)}>Reset password</button>{" "}
                      <button className="button button-small button-danger" disabled={busy || self}
                        onClick={() => remove(user)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
