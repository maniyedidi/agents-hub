import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { AgentModel } from "../agents/agent.model";
import { ingestText, searchMemory } from "./memory.service";

const ALLOWED_EXTENSIONS = [".txt", ".md"];

export async function memoryRoutes(app: FastifyInstance) {
  // Ingest a text file into an agent's memory.
  // Multipart: field "file". JSON alternative: { "name": "notes.txt", "text": "..." }.
  app.post("/api/agents/:id/memory", async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!mongoose.isValidObjectId(id) || !(await AgentModel.exists({ _id: id }))) {
      return reply.code(404).send({ error: "Agent not found" });
    }

    let name: string | undefined;
    let text: string | undefined;

    if (request.isMultipart()) {
      const file = await request.file();
      if (!file) return reply.code(400).send({ error: "File is required" });
      name = file.filename;
      text = (await file.toBuffer()).toString("utf8");
    } else {
      const body = request.body as { name?: string; text?: string };
      name = body?.name;
      text = body?.text;
    }

    if (!name || !text?.trim()) {
      return reply.code(400).send({ error: "File name and text are required" });
    }

    if (!ALLOWED_EXTENSIONS.some(ext => name!.toLowerCase().endsWith(ext))) {
      return reply.code(400).send({ error: "Only .txt and .md files are supported" });
    }

    try {
      return reply.code(201).send(await ingestText(id, name, text));
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