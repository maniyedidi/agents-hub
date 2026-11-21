## Commands

- `npm run dev` — API server via `tsx apps/api/src/server.ts` (port `PORT`, default 3000).
- `npm run dev:web` — Vite dev server for the React UI on `http://localhost:5173` (proxies `/api` to `localhost:3000`).
- `npm run build:web` — builds the UI into `apps/api/public/` (committed to git; `emptyOutDir` wipes it). The API serves that directory statically if it exists.
- `npm test` is a placeholder; there is no test framework, linter, or `tsconfig.json`. TS runs directly through `tsx`.

Runtime prerequisites: MongoDB (`MONGODB_URI` is required — the server exits without it), Qdrant Cloud (`QDRANT_URL`/`QDRANT_API_KEY`, also required at startup), a Docker daemon, and an Ollama server. Copy `.env.example` to `.env`.

## Configuration (env vars, loaded via dotenv)

`MONGODB_URI`, `PORT`, `OLLAMA_URL`, `WORKSPACE_ROOT` (default `./workspaces`), and sandbox defaults `DOCKER_IMAGE`, `DOCKER_MEMORY`, `DOCKER_CPUS`, `DOCKER_TIMEOUT` (ms). `LOCAL_MODEL` is now only a leftover constant in `agent.ts`; the model comes from the agent document.

## Layout

```
apps/api/src/
  server.ts            entry: connect Mongo/Qdrant, seed admin, listen
  app.ts               buildApp(): jwt, multipart, auth hook, routes, static UI
  config/              database.ts, qdrant.ts (client, embed(), index setup)
  sandbox/             docker-manager.ts (hardened throwaway container)
  modules/
    auth/              auth.hook.ts (authenticate, requireAdmin), auth.routes.ts, auth.service.ts (scrypt, seedAdmin)
    users/             user.model.ts, user.routes.ts (admin-only CRUD)
    agents/            agent.model.ts, agent.routes.ts (CRUD + chat), agent.run.routes.ts (POST /api/agents/run), agent.runner.ts (Ollama tool loop)
    memory/            memory.routes.ts, memory.service.ts (chunk/embed/search in Qdrant)
    tools/             toolbox.ts (tool defs + dispatch), workspace.tool.ts (in-container files), mongo.tool.ts, mcp.client.ts
apps/web/src/
  main.jsx             entry only
  App.jsx              router + auth gate (routes: /login, /agents, /agents/new, /agents/:id/edit|chat|files, /users)
  api/client.js        fetch wrapper + token storage
  constants.js         tool/image allowlists (mirror the API) and emptyAgent()
  layouts/             AppLayout (sidebar, topbar, loads agents)
  pages/               LoginPage, AgentsListPage, AgentRoutes (new/edit/chat/files/users pages)
  components/          AgentForm, MemoryModal, ChatModal, UsersModal
  styles/index.css
```

Dependencies point downward: routes -> services/runner -> tools/config. Feature code lives in its `modules/<name>/` folder.

## Auth (demo)

All `/api/*` routes except `POST /api/auth/login` require `Authorization: Bearer <jwt>` (hook in [auth.hook.ts](apps/api/src/modules/auth/auth.hook.ts)). No self-registration: only admins create users (`POST /api/users`, plus list/PATCH/DELETE). The first admin is seeded from `ADMIN_EMAIL`/`ADMIN_PASSWORD` when the users collection is empty. `JWT_SECRET` is required at startup. Passwords use scrypt; tokens last 12h and the user is re-checked (active/role) on every request.

## Architecture

Agents are **MongoDB documents** ([agent.model.ts](apps/api/src/modules/agents/agent.model.ts)) holding `instructions` (the system prompt), `model.name`, `tools`, `dbCollections`, `mcpServers`, `maxSteps`, and `runtime` settings.

- **Run:** `POST /api/agents/run` ([agent.run.routes.ts](apps/api/src/modules/agents/agent.run.routes.ts)) looks up the agent **by `name`**, creates a `DockerSandboxManager`, calls `runAgent`, and always `destroy()`s the sandbox in `finally`. The sandbox uses env-var defaults, not the agent's `runtime`; agentId is hard-coded `"coder"`.
- **Memory upload:** `POST /api/agents/:id/memory` accepts several multipart `file` parts (.txt/.md, 2 MB each, 20 max) and returns per-file results.
- **Chat:** `POST /api/agents/:id/chat` retrieves memory for the message and runs the same tool loop without a sandbox (file tools are not offered).
- **Tool loop:** [agent.runner.ts](apps/api/src/modules/agents/agent.runner.ts) calls Ollama `/api/chat` up to `maxSteps`, executing tool calls through the toolbox.
- **Tools:** [toolbox.ts](apps/api/src/modules/tools/toolbox.ts) offers only the tools enabled on the agent: file tools (sandbox only), `search_memory`, `mongo_find` (read-only, per-agent `dbCollections` allowlist), and `mcp` (remote HTTP MCP servers).
- **Sandbox:** no network, read-only rootfs, caps dropped, pid/memory/cpu limits, noexec `/tmp`; host dir `WORKSPACE_ROOT/<agentId>/<executionId>` bind-mounted at `/workspace`.
- **Memory:** `EMBEDDING_DIMENSIONS` must match the embedding model.

Adding a tool means touching: the definition and dispatch in `modules/tools/toolbox.ts` (implementation in its own `*.tool.ts`), `ALLOWED_TOOLS` in `agent.routes.ts`, and `AVAILABLE_TOOLS` in `apps/web/src/constants.js`. Adding an allowed image means updating `ALLOWED_IMAGES` in `agent.routes.ts` and `AVAILABLE_IMAGES` in `constants.js`.

## Known rough edges

- Imports are extensionless relative paths, relying on `tsx`.
- `bullmq`, `ioredis`, and `pg` (and `DATABASE_URL`) are unused.