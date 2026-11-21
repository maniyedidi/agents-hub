import { useState } from "react";
import { authHeaders, request } from "../api/client";

export function MemoryModal({ agent, onClose }) {
  const [uploads, setUploads] = useState([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [question, setQuestion] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  async function uploadFiles(fileList) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setBusy(true);
    setError("");

    for (const file of files) {
      const entry = { name: file.name };
      if (!/\.(txt|md)$/i.test(file.name)) {
        entry.error = "Only .txt and .md files are supported";
      } else {
        try {
          const body = new FormData();
          body.append("file", file);
          // No JSON Content-Type here: the browser sets the multipart boundary.
          const response = await fetch(`/api/agents/${agent._id}/memory`, { method: "POST", body, headers: authHeaders() });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Upload failed");
          entry.chunks = result.chunks;
        } catch (uploadError) {
          entry.error = uploadError.message;
        }
      }
      setUploads(current => [entry, ...current]);
    }
    setBusy(false);
  }

  async function search(event) {
    event.preventDefault();
    if (!question.trim()) return;
    setError("");
    try {
      setResults(await request(
        `/api/agents/${agent._id}/memory/search?q=${encodeURIComponent(question)}`
      ));
    } catch (searchError) {
      setError(searchError.message);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="agent-modal" role="dialog" aria-modal="true" aria-labelledby="memory-title">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">AGENT MEMORY</p>
            <h2 id="memory-title">{agent.name} files</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="agent-form">
          <label
            className={`dropzone ${dragging ? "dropzone-active" : ""}`}
            onDragOver={event => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={event => {
              event.preventDefault();
              setDragging(false);
              uploadFiles(event.dataTransfer.files);
            }}
          >
            <input
              type="file"
              multiple
              accept=".txt,.md,text/plain,text/markdown"
              disabled={busy}
              onChange={event => {
                uploadFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <strong>{busy ? "Uploading…" : "Drop .txt or .md files here, or click to browse"}</strong>
            <small>Files are chunked and stored in this agent's memory. Re-uploading a file replaces it.</small>
          </label>

          {uploads.length > 0 && (
            <ul className="upload-list">
              {uploads.map((upload, index) => (
                <li key={index} className={upload.error ? "upload-error" : ""}>
                  <span>{upload.name}</span>
                  <small>{upload.error || `${upload.chunks} chunks stored`}</small>
                </li>
              ))}
            </ul>
          )}

          <form className="memory-search" onSubmit={search}>
            <input
              value={question}
              onChange={event => setQuestion(event.target.value)}
              placeholder="Test memory: ask a question…"
              aria-label="Search memory"
            />
            <button className="button" type="submit">Search</button>
          </form>

          {results && (results.length === 0
            ? <p className="subtitle">No matching content.</p>
            : (
              <ul className="upload-list">
                {results.map((hit, index) => (
                  <li key={index}>
                    <span>{hit.source} <small>· score {hit.score?.toFixed(2)}</small></span>
                    <small className="hit-text">{hit.text}</small>
                  </li>
                ))}
              </ul>
            ))}

          {error && <p className="inline-error" role="alert">{error}</p>}

          <div className="form-actions">
            <button className="button button-primary" type="button" onClick={onClose}>Done</button>
          </div>
        </div>
      </section>
    </div>
  );
}
