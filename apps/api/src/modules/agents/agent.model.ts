
import mongoose, { Schema } from "mongoose";

const AgentSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    description: {
      type: String,
      default: ""
    },

    instructions: {
      type: String,
      required: true
    },

    model: {
      provider: {
        type: String,
        default: "ollama",
        enum: ["ollama"]
      },

      name: {
        type: String,
        required: true
      }
    },

    runtime: {
      type: {
        type: String,
        default: "docker",
        enum: ["docker"]
      },

      image: {
        type: String,
        default: "node:22-alpine"
      },

      memory: {
        type: Number,
        default: 536870912
      },

      cpus: {
        type: Number,
        default: 1
      },

      timeout: {
        type: Number,
        default: 300000
      }
    },

    tools: [{
      type: String
    }],

    // Collections the agent may read with the mongo_find tool.
    dbCollections: [{
      type: String
    }],

    // Remote (HTTP) MCP servers, used when the "mcp" tool is enabled.
    mcpServers: [{
      _id: false,
      name: { type: String, required: true },
      url: { type: String, required: true },
      authToken: { type: String, select: false }
    }],

    maxSteps: {
      type: Number,
      default: 10
    },

    enabled: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export const AgentModel = mongoose.model("Agent", AgentSchema);
