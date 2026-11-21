export const AVAILABLE_TOOLS = ["list_files", "read_file", "write_file", "search_memory", "mongo_find", "mcp"];
export const AVAILABLE_IMAGES = ["node:22-alpine", "python:3.12-slim"];

export const emptyAgent = () => ({
  name: "",
  slug: "",
  description: "",
  instructions: "",
  model: { provider: "ollama", name: "" },
  runtime: {
    type: "docker",
    image: AVAILABLE_IMAGES[0],
    memory: 536870912,
    cpus: 1,
    timeout: 300000
  },
  tools: [],
  dbCollections: [],
  mcpServers: [],
  maxSteps: 10,
  enabled: true
});
