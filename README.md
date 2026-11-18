# agents-hub
A Node.js service for defining AI agents and running them against a local Ollama model. Each run executes in an isolated, throwaway Docker sandbox.

## Prerequisites

- Node.js and npm
- MongoDB (agent definitions are stored here)
- A Qdrant Cloud cluster (cloud.qdrant.io) for the vector store, plus an Ollama embedding model (`ollama pull nomic-embed-text`)
- Docker daemon (sandbox for each run)
- Ollama server with the model your agent uses (e.g. `qwen3:8b`)

## Setup

```bash
npm install
cp .env.example .env   # then adjust values
```

Key variables: `MONGODB_URI` (required), `QDRANT_URL` and `QDRANT_API_KEY` (required), `QDRANT_COLLECTION`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS` (must match the embedding model), `PORT` (default 3000), `OLLAMA_URL`, `WORKSPACE_ROOT`, `DOCKER_IMAGE`, `DOCKER_MEMORY`, `DOCKER_CPUS`, `DOCKER_TIMEOUT`.

## Running

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the API on `http://localhost:3000` |
| `npm run dev:web` | Start the UI dev server on `http://localhost:5173` (proxies `/api` to the API) |
| `npm run build:web` | Build the UI into `apps/api/public`, served by the API at `http://localhost:3000` |