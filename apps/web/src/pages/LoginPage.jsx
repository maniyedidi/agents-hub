import { useState } from "react";
import { request, setToken } from "../api/client";

export function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { token, user } = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      setToken(token);
      onLogin(user);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="main-content">
      <section className="page-content" style={{ maxWidth: 380, margin: "10vh auto" }}>
        <img src="/favicon.svg" alt="Agents Hub" width="44" height="44" style={{ marginBottom: 12 }} />
        <h1>Sign in</h1>
        <p className="subtitle">Accounts are created by an administrator.</p>
        <form className="agent-form" onSubmit={submit}>
          <label>
            Email
            <input type="email" required autoFocus value={email}
              onChange={event => setEmail(event.target.value)} />
          </label>
          <label>
            Password
            <input type="password" required value={password}
              onChange={event => setPassword(event.target.value)} />
          </label>
          {error && <p className="inline-error" role="alert">{error}</p>}
          <button className="button button-primary" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
