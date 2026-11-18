import { QdrantClient } from "@qdrant/js-client-rest";

let client: QdrantClient | null = null;

export function getQdrant() {
  if (client) return client;

  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;

  if (!url || !apiKey) {
    throw new Error("QDRANT_URL and QDRANT_API_KEY are required");
  }

  client = new QdrantClient({ url, apiKey });
  return client;
}

export const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || "agents_hub_memory";

// Embed text with Ollama (default model: nomic-embed-text, 768 dims).
export async function embed(text: string): Promise<number[]> {
  const response = await fetch(
    `${process.env.OLLAMA_URL || "http://localhost:11434"}/api/embed`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.EMBEDDING_MODEL || "nomic-embed-text",
        input: text
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Embedding error: ${response.status} ${await response.text()}`);
  }

  const data: any = await response.json();
  return data.embeddings[0];
}

export async function connectQdrant() {
  const qdrant = getQdrant();
  const size = Number(process.env.EMBEDDING_DIMENSIONS || 768);

  const { collections } = await qdrant.getCollections();

  if (!collections.some(c => c.name === QDRANT_COLLECTION)) {
    await qdrant.createCollection(QDRANT_COLLECTION, {
      vectors: { size, distance: "Cosine" }
    });
    console.log(`Qdrant collection created: ${QDRANT_COLLECTION}`);
  }

  console.log("Qdrant connected successfully");
}