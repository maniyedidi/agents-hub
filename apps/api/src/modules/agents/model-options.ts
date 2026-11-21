// Per-agent model settings stored on the agent document (model.options).
// Anything missing or blank falls back to these defaults, both when saving
// and when running, so older agents keep working.

export type ThinkMode = "auto" | "on" | "off";

export type ModelOptions = {
  temperature: number;
  topP: number;
  topK: number;
  repeatPenalty: number;
  numCtx: number;
  numPredict: number;
  seed: number | null;
  think: ThinkMode;
};

export const DEFAULT_MODEL_OPTIONS: ModelOptions = {
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  repeatPenalty: 1.1,
  numCtx: 4096,
  numPredict: 2048,
  seed: null,
  think: "auto"
};

const NUMERIC_RULES: Record<string, { min: number; max: number; integer?: boolean; label: string }> = {
  temperature: { min: 0, max: 2, label: "Temperature" },
  topP: { min: 0.01, max: 1, label: "Top P" },
  topK: { min: 1, max: 200, integer: true, label: "Top K" },
  repeatPenalty: { min: 0.5, max: 2, label: "Repeat penalty" },
  numCtx: { min: 512, max: 131072, integer: true, label: "Context window" },
  numPredict: { min: -1, max: 32768, integer: true, label: "Max output tokens" }
};

const isBlank = (value: unknown) => value === undefined || value === null || value === "";

// Merge stored options over the defaults, ignoring unknown keys and blanks.
export function resolveModelOptions(stored: any): ModelOptions {
  const merged: any = { ...DEFAULT_MODEL_OPTIONS };
  for (const key of Object.keys(DEFAULT_MODEL_OPTIONS)) {
    if (stored && !isBlank(stored[key])) merged[key] = stored[key];
  }
  return merged;
}

// Validate user input. Returns the full options (defaults filled in) or an error message.
export function sanitizeModelOptions(input: any): { options?: ModelOptions; error?: string } {
  if (input !== undefined && input !== null && (typeof input !== "object" || Array.isArray(input))) {
    return { error: "Invalid model options" };
  }

  const options: any = { ...DEFAULT_MODEL_OPTIONS };

  for (const [key, rule] of Object.entries(NUMERIC_RULES)) {
    const raw = input?.[key];
    if (isBlank(raw)) continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < rule.min || value > rule.max ||
        (rule.integer && !Number.isInteger(value))) {
      return { error: `${rule.label} must be ${rule.integer ? "a whole number" : "a number"} between ${rule.min} and ${rule.max}` };
    }
    if (key === "numPredict" && value === 0) {
      return { error: "Max output tokens must be -1 (unlimited) or at least 1" };
    }
    options[key] = value;
  }

  if (!isBlank(input?.seed)) {
    const seed = Number(input.seed);
    if (!Number.isInteger(seed) || seed < 0) {
      return { error: "Seed must be a whole number of 0 or more (leave blank for random)" };
    }
    options.seed = seed;
  }

  if (!isBlank(input?.think)) {
    if (!["auto", "on", "off"].includes(input.think)) {
      return { error: "Thinking must be auto, on or off" };
    }
    options.think = input.think;
  }

  return { options };
}

// Translate to the Ollama /api/chat request fields.
export function toOllamaParams(stored: any) {
  const o = resolveModelOptions(stored);
  return {
    options: {
      temperature: o.temperature,
      top_p: o.topP,
      top_k: o.topK,
      repeat_penalty: o.repeatPenalty,
      num_ctx: o.numCtx,
      num_predict: o.numPredict,
      ...(o.seed !== null ? { seed: o.seed } : {})
    },
    // Only sent when set explicitly: models without thinking support reject the field.
    ...(o.think === "on" ? { think: true } : o.think === "off" ? { think: false } : {})
  };
}
