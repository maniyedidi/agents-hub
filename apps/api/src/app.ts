import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyJwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { authenticate } from "./modules/auth/auth.hook";
import { authRoutes } from "./modules/auth/auth.routes";
import { userRoutes } from "./modules/users/user.routes";
import { agentRoutes } from "./modules/agents/agent.routes";
import { agentRunRoutes } from "./modules/agents/agent.run.routes";
import { memoryRoutes } from "./modules/memory/memory.routes";

export async function buildApp() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing");
  }

  const app = Fastify({ logger: true });

  await app.register(fastifyJwt, { secret: process.env.JWT_SECRET });
  await app.register(multipart, { limits: { fileSize: 2 * 1024 * 1024, files: 20 } });
  app.addHook("onRequest", authenticate);

  app.get("/health", async () => ({ status: "ok", service: "agents-hub" }));

  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(agentRoutes);
  await app.register(agentRunRoutes);
  await app.register(memoryRoutes);

  // Built web UI (npm run build:web), if present.
  const webRoot = fileURLToPath(new URL("../public/", import.meta.url));
  if (existsSync(webRoot)) {
    await app.register(fastifyStatic, { root: webRoot });

    // SPA fallback: client-side routes (e.g. /agents/new) serve index.html.
    app.setNotFoundHandler((request, reply) => {
      const path = request.url.split("?")[0];
      if (request.method === "GET" && !path.startsWith("/api/") && !path.includes(".")) {
        return reply.sendFile("index.html");
      }
      return reply.code(404).send({ error: "Not found" });
    });
  } else {
    app.log.warn("Web UI build not found; run `npm run build:web` or `npm run dev:web`");
  }

  return app;
}
