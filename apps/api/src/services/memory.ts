import { createHash } from "node:crypto";
import { embed, getQdrant, QDRANT_COLLECTION } from "../config/qdrant";

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

// Split text into overlapping chunks, preferring to break on paragraph/line/space boundaries.
export function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + CHUNK_SIZE, clean.length);

    if (end < clean.length) {
      const window = clean.slice(start, end);
      const breakAt = Math.max(
        window.lastIndexOf("\n\n"),
        window.lastIndexOf("\n"),
        window.lastIndexOf(" ")
      );
      if (breakAt > CHUNK_SIZE / 2) end = start + breakAt;
    }

    const chunk = clean.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= clean.length) break;
    start = end - CHUNK_OVERLAP;
  }

  return chunks;
}

// Qdrant point IDs must be UUIDs or integers; derive a stable UUID so re-ingesting overwrites.
function pointId(agentId: string, source: string, index: number) {
  const h = createHash("sha1").update(`${agentId}:${source}:${index}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export async function ingestText(agentId: string, source: string, text: string) {
  const qdrant = getQdrant();
  const chunks = chunkText(text);

  if (chunks.length === 0) throw new Error("File contains no text");

  // Remove old chunks for this file so a shorter re-upload leaves no stale data.
  await qdrant.delete(QDRANT_COLLECTION, {
    wait: true,
    filter: {
      must: [
        { key: "agentId", match: { value: agentId } },
        { key: "source", match: { value: source } }
      ]
    }
  });

  const points = [];
  for (let i = 0; i < chunks.length; i++) {
    points.push({
      id: pointId(agentId, source, i),
      vector: await embed(chunks[i]),
      payload: { agentId, source, chunkIndex: i, text: chunks[i] }
    });
  }

  await qdrant.upsert(QDRANT_COLLECTION, { wait: true, points });

  return { source, chunks: chunks.length };
}

export async function searchMemory(agentId: string, query: string, limit = 5) {
  const { points } = await getQdrant().query(QDRANT_COLLECTION, {
    query: await embed(query),
    limit,
    with_payload: true,
    filter: { must: [{ key: "agentId", match: { value: agentId } }] }
  });

  return points.map(r => ({
    score: r.score,
    source: r.payload?.source,
    chunkIndex: r.payload?.chunkIndex,
    text: r.payload?.text
  }));
}