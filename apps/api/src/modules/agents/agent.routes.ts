
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { AgentModel } from "./agent.model";
import { chatWithAgent } from "./agent.runner";

const ALLOWED_TOOLS = [
  "list_files",
  "read_file",
  "write_file",
  "search_memory",
  "mongo_find",
  "mcp"
];

const ALLOWED_IMAGES = [
  "node:22-alpine",
  "python:3.12-slim"
];

function invalidMcpServers(servers: any) {
  if (servers === undefined) return false;
  return !Array.isArray(servers) || !servers.every((s: any) => {
    try {
      const url = new URL(s?.url);
      return typeof s?.name === "string" && s.name.trim() &&
        (url.protocol === "https:" || url.protocol === "http:");
    } catch {
      return false;
    }
  });
}

export async function agentRoutes(app: FastifyInstance) {

  app.post("/api/agents/:id/chat", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      message?: string;
      history?: { role: "user" | "assistant"; content: string }[];
    };

    if (!mongoose.isValidObjectId(id)) {
      return reply.code(400).send({ error: "Invalid agent ID" });
    }

    if (typeof body?.message !== "string" || !body.message.trim()) {
      return reply.code(400).send({ error: "Message is required" });
    }

    if (
      body.history !== undefined &&
      (!Array.isArray(body.history) ||
        body.history.length > 20 ||
        !body.history.every(item =>
          item !== null &&
          typeof item === "object" &&
          (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string"
        ))
    ) {
      return reply.code(400).send({ error: "Invalid chat history" });
    }

    const agent = await AgentModel.findById(id)
      .select("+mcpServers.authToken")
      .lean();
    if (!agent) {
      return reply.code(404).send({ error: "Agent not found" });
    }

    try {
      const response = await chatWithAgent(
        agent,
        body.message.trim(),
        body.history
      );
      return { reply: response };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error: error instanceof Error ? error.message : "Chat request failed"
      });
    }
  });

  // Create Agent
  app.post("/api/agents", async (request, reply) => {
    try {
      const body = request.body as any;

      if (!body.name || !body.instructions) {
        return reply.code(400).send({
          error: "Name and instructions are required"
        });
      }

      const slug = body.slug ||
        body.name.toLowerCase().trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

      if (
        body.tools &&
        (!Array.isArray(body.tools) ||
          !body.tools.every((tool: string) =>
            ALLOWED_TOOLS.includes(tool)
          ))
      ) {
        return reply.code(400).send({
          error: "Invalid tool selection"
        });
      }

      if (invalidMcpServers(body.mcpServers)) {
        return reply.code(400).send({ error: "Invalid MCP servers" });
      }

      if (
        body.runtime?.image &&
        !ALLOWED_IMAGES.includes(body.runtime.image)
      ) {
        return reply.code(400).send({
          error: "Docker image not allowed"
        });
      }

      const agent = await AgentModel.create({
        ...body,
        slug
      });

      return reply.code(201).send(agent);

    } catch (error: any) {
      if (error.code === 11000) {
        return reply.code(409).send({
          error: "Agent slug already exists"
        });
      }

      return reply.code(400).send({
        error: error.message
      });
    }
  });

  // List Agents
  app.get("/api/agents", async () => {
    return AgentModel.find()
      .sort({ createdAt: -1 })
      .lean();
  });

  // Get Agent
  app.get("/api/agents/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!mongoose.isValidObjectId(id)) {
      return reply.code(400).send({
        error: "Invalid agent ID"
      });
    }

    const agent = await AgentModel.findById(id).lean();

    if (!agent) {
      return reply.code(404).send({
        error: "Agent not found"
      });
    }

    return agent;
  });

  // Update Agent
  app.put("/api/agents/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!mongoose.isValidObjectId(id)) {
      return reply.code(400).send({
        error: "Invalid agent ID"
      });
    }

    const body = request.body as any;

    if (
      body.tools &&
      (!Array.isArray(body.tools) ||
        !body.tools.every((tool: string) =>
          ALLOWED_TOOLS.includes(tool)
        ))
    ) {
      return reply.code(400).send({
        error: "Invalid tool selection"
      });
    }

    if (invalidMcpServers(body.mcpServers)) {
      return reply.code(400).send({ error: "Invalid MCP servers" });
    }

    if (
      body.runtime?.image &&
      !ALLOWED_IMAGES.includes(body.runtime.image)
    ) {
      return reply.code(400).send({
        error: "Docker image not allowed"
      });
    }

    // Prevent clients from changing internal MongoDB fields.
    const allowedFields = [
      "name",
      "slug",
      "description",
      "instructions",
      "model",
      "runtime",
      "tools",
      "dbCollections",
      "mcpServers",
      "maxSteps",
      "enabled"
    ];

    const update = Object.fromEntries(
      Object.entries(body).filter(([key]) =>
        allowedFields.includes(key)
      )
    );

    // The UI never receives stored tokens, so keep the existing one when left blank.
    if (Array.isArray((update as any).mcpServers)) {
      const existing = await AgentModel.findById(id)
        .select("+mcpServers.authToken")
        .lean();
      for (const server of (update as any).mcpServers) {
        if (!server.authToken) {
          const previous = existing?.mcpServers?.find((s: any) => s.name === server.name);
          if (previous?.authToken) server.authToken = previous.authToken;
          else delete server.authToken;
        }
      }
    }

    const agent = await AgentModel.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!agent) {
      return reply.code(404).send({
        error: "Agent not found"
      });
    }

    return agent;
  });

  // Delete Agent
  app.delete("/api/agents/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    if (!mongoose.isValidObjectId(id)) {
      return reply.code(400).send({
        error: "Invalid agent ID"
      });
    }

    const agent = await AgentModel.findByIdAndDelete(id);

    if (!agent) {
      return reply.code(404).send({
        error: "Agent not found"
      });
    }

    return { success: true };
  });
}
