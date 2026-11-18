## Commands

- `npm run dev` — API server via `tsx apps/api/src/server.ts` (port `PORT`, default 3000).
- `npm run dev:web` — Vite dev server for the React UI on `http://localhost:5173` (proxies `/api` to `localhost:3000`).
- `npm run build:web` — builds the UI into `apps/api/public/` (committed to git; `emptyOutDir` wipes it). The API serves that directory statically if it exists.
- `npm test` is a placeholder; there is no test framework, linter, or `tsconfig.json`. TS runs directly through `tsx`.

Runtime prerequisites: MongoDB (`MONGODB_URI` is required — the server exits without it), Qdrant Cloud (`QDRANT_URL`/`QDRANT_API_KEY`, also required at startup), a Docker daemon, and an Ollama server. Copy `.env.example` to `.env`.

## Configuration (env vars, loaded via dotenv)

`MONGODB_URI`, `PORT`, `OLLAMA_URL`, `WORKSPACE_ROOT` (default `./workspaces`), and sandbox defaults `DOCKER_IMAGE`, `DOCKER_MEMORY`, `DOCKER_CPUS`, `DOCKER_TIMEOUT` (ms). `LOCAL_MODEL` is now only a leftover constant in `agent.ts`; the model comes from the agent document.

## Architecture

Agents are **MongoDB documents** (mongoose, [agent.model.ts](apps/api/src/models/agent.model.ts)) holding `instructions` (the system prompt), `model.name`, `tools`, `maxSteps`, and `runtime` settings. A run executes one agent against one throwaway Docker container:

1. [server.ts](apps/api/src/server.ts) — `POST /api/agents/run` with `{name, task}` looks up the agent **by `name`** (not slug/id), creates a `DockerSandboxManager`, calls `runAgent(agent, task, sandbox)`, and always `destroy()`s the sandbox in `finally`. Also registers CRUD routes and static UI hosting.
2. [routes/agent.routes.ts](apps/api/src/routes/agent.routes.ts) — CRUD under `/api/agents` (`:id` is a Mongo ObjectId). Validates `tools` and `runtime.image` against hard-coded allowlists (`ALLOWED_TOOLS`, `ALLOWED_IMAGES`); PUT whitelists updatable fields.
3. [agent.ts](apps/api/src/agent.ts) — `runAgent` loops up to `agent.maxSteps` calling Ollama `/api/chat`, executes `tool_calls`, and appends `role: "tool"` results until the model answers without tool calls. The `tools` schema array is global; `agent.tools` is not used to filter it yet.
4. [packages/tools/workspace.ts](packages/tools/workspace.ts) — `listFiles`/`readFile`/`writeFile` implemented by running `find`/`node -e` **inside the container**; paths are confined to `/workspace`.
5. [sandbox/docker-manager.ts](sandbox/docker-manager.ts) — hardened container (no network, read-only rootfs, caps dropped, pid/memory/cpu limits, noexec `/tmp`) with host dir `WORKSPACE_ROOT/<agentId>/<executionId>` bind-mounted at `/workspace`. Currently uses env-var defaults, not the agent's `runtime` settings; `server.ts` hard-codes agentId `"coder"`.
6. [config/qdrant.ts](apps/api/src/config/qdrant.ts) — Qdrant client, `embed()` (Ollama `/api/embed`) and `connectQdrant()`, which creates the collection on startup. `EMBEDDING_DIMENSIONS` must match the embedding model. Nothing reads/writes vectors yet.
7. [apps/web](apps/web) — single-file React 19 UI ([main.jsx](apps/web/src/main.jsx)) for agent CRUD; mirrors the tool/image allowlists as constants.

Adding a tool means touching: the `tools` schema array and `executeTool` switch in `agent.ts`, the implementation in `packages/tools`, `ALLOWED_TOOLS` in the routes, and `AVAILABLE_TOOLS` in `main.jsx`. Adding an allowed image means updating `ALLOWED_IMAGES` in the routes and `AVAILABLE_IMAGES` in `main.jsx`.

## Known rough edges

- Imports are extensionless relative paths, relying on `tsx`.
- `server.ts` imports `randomUUID` from `bullmq/dist/esm/utils` (internal path); `node:crypto` is the stable alternative.
- In `/api/agents/run`, the agent lookup and 404 happen before the `try`, so a missing/invalid body or DB error is not handled by the route's error handling.
- `bullmq`, `ioredis`, and `pg` (and `DATABASE_URL`) are unused.