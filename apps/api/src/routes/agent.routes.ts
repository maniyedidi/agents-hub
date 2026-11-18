
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { AgentModel } from "../models/agent.model";

const ALLOWED_TOOLS = [
  "list_files",
  "read_file",
  "write_file",
  "search_memory"
];

const ALLOWED_IMAGES = [
  "node:22-alpine",
  "python:3.12-slim"
];

export async function agentRoutes(app: FastifyInstance) {

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
      "maxSteps",
      "enabled"
    ];

    const update = Object.fromEntries(
      Object.entries(body).filter(([key]) =>
        allowedFields.includes(key)
      )
    );

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
