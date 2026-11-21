import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { AgentModel } from "../agents/agent.model";
import { ingestText, searchMemory } from "./memory.service";

const ALLOWED_EXTENSIONS = [".txt", ".md"];

export async function memoryRoutes(app: FastifyInstance) {
  // Ingest text files into an agent's memory.
  // Multipart: one or more "file" parts -> { results: [{ source, chunks } | { source, error }] }.
  // JSON alternative (single file): { "name": "notes.txt", "text": "..." }.
  app.post("/api/agents/:id/memory", async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!mongoose.isValidObjectId(id) || !(await AgentModel.exists({ _id: id }))) {
      return reply.code(404).send({ error: "Agent not found" });
    }

    const isSupported = (name: string) =>
      ALLOWED_EXTENSIONS.some(ext => name.toLowerCase().endsWith(ext));

    if (request.isMultipart()) {
      const results: Array<{ source: string; chunks?: number; error?: string }> = [];

      for await (const file of request.files()) {
        const source = file.filename;
        // Always drain the stream, even for rejected files.
        const buffer = await file.toBuffer();

        if (file.file.truncated) {
          results.push({ source, error: "File is too large (2 MB max)" });
        } else if (!isSupported(source)) {
          results.push({ source, error: "Only .txt and .md files are supported" });
        } else {
          const text = buffer.toString("utf8");
          try {
            if (!text.trim()) throw new Error("File contains no text");
            results.push(await ingestText(id, source, text));
          } catch (error: any) {
            request.log.error(error);
            results.push({ source, error: error.message });
          }
        }
      }

      if (results.length === 0) return reply.code(400).send({ error: "File is required" });
      return reply.code(201).send({ results });
    }

    const body = request.body as { name?: string; text?: string };
    if (!body?.name || !body.text?.trim()) {
      return reply.code(400).send({ error: "File name and text are required" });
    }
    if (!isSupported(body.name)) {
      return reply.code(400).send({ error: "Only .txt and .md files are supported" });
    }

    try {
      return reply.code(201).send(await ingestText(id, body.name, body.text));
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // Search an agent's memory.
  app.get("/api/agents/:id/memory/search", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { q } = request.query as { q?: string };

    if (!q?.trim()) return reply.code(400).send({ error: "Query q is required" });

    return searchMemory(id, q);
  });
}