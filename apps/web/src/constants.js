export const AVAILABLE_TOOLS = ["list_files", "read_file", "write_file", "search_memory", "mongo_find", "mcp"];
export const AVAILABLE_IMAGES = ["node:22-alpine", "python:3.12-slim"];

// Mirrors DEFAULT_MODEL_OPTIONS in apps/api/src/modules/agents/model-options.ts.
export const DEFAULT_MODEL_OPTIONS = {
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  repeatPenalty: 1.1,
  numCtx: 4096,
  numPredict: 2048,
  seed: "",
  think: "auto"
};

// label, key, step/min/max and a short hint for the "Model settings" form.
export const MODEL_OPTION_FIELDS = [
  { key: "temperature", label: "Temperature", step: 0.1, min: 0, max: 2, hint: "0 = focused, higher = more creative" },
  { key: "topP", label: "Top P", step: 0.05, min: 0.01, max: 1, hint: "Nucleus sampling cutoff" },
  { key: "topK", label: "Top K", step: 1, min: 1, max: 200, hint: "Sample from the K likeliest tokens" },
  { key: "repeatPenalty", label: "Repeat penalty", step: 0.05, min: 0.5, max: 2, hint: "Above 1 discourages repetition" },
  { key: "numCtx", label: "Context window", step: 512, min: 512, max: 131072, hint: "Tokens of prompt + history the model sees" },
  { key: "numPredict", label: "Max output tokens", step: 128, min: -1, max: 32768, hint: "-1 = no limit" },
  { key: "seed", label: "Seed", step: 1, min: 0, hint: "Blank = random; set for repeatable output" }
];

export const emptyAgent = () => ({
  name: "",
  slug: "",
  description: "",
  instructions: "",
  model: { provider: "ollama", name: "", options: { ...DEFAULT_MODEL_OPTIONS } },
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
