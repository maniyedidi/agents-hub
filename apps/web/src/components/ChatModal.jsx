import { useState } from "react";
import { request } from "../api/client";

export function ChatModal({ agent, onClose }) {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function send(event) {
    event.preventDefault();
    const content = message.trim();
    if (!content || sending) return;

    const history = messages.map(({ role, content: text }) => ({ role, content: text }));
    setMessages(current => [...current, { role: "user", content }]);
    setMessage("");
    setSending(true);
    setError("");

    try {
      const result = await request(`/api/agents/${agent._id}/chat`, {
        method: "POST",
        body: JSON.stringify({ message: content, history })
      });
      setMessages(current => [...current, { role: "assistant", content: result.reply }]);
    } catch (chatError) {
      setError(chatError.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="agent-modal chat-modal" role="dialog" aria-modal="true" aria-labelledby="chat-title">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">AGENT CHAT</p>
            <h2 id="chat-title">{agent.name}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="chat-messages" aria-live="polite">
          {messages.length === 0 && (
            <p className="chat-empty">Ask a question. {agent.name} will use its saved memory when relevant.</p>
          )}
          {messages.map((item, index) => (
            <article key={index} className={`chat-message chat-${item.role}`}>
              <span>{item.role === "user" ? "You" : agent.name}</span>
              <p>{item.content}</p>
            </article>
          ))}
          {sending && <p className="chat-thinking">{agent.name} is thinking…</p>}
        </div>

        {error && <p className="inline-error" role="alert">{error}</p>}

        <form className="chat-composer" onSubmit={send}>
          <textarea
            value={message}
            onChange={event => setMessage(event.target.value)}
            placeholder="Message this agent…"
            aria-label="Message this agent"
            rows="2"
            disabled={sending}
          />
          <button className="button button-primary" type="submit" disabled={sending || !message.trim()}>
            {sending ? "Sending…" : "Send"}
          </button>
        </form>
      </section>
    </div>
  );
}
