import { searchMemory } from "../memory/memory.service";
import { createWorkspaceTools } from "./workspace.tool";
import type { DockerSandboxManager } from "../../sandbox/docker-manager";
import { mongoFind } from "./mongo.tool";
import { connectMcpServers } from "./mcp.client";

type ToolDef = {
    type: "function";
    function: { name: string; description: string; parameters: any };
};

const MAX_TOOL_RESULT_CHARS = 20000;

const BUILTIN_TOOLS: Record<string, ToolDef> = {
    list_files: {
        type: "function",
        function: {
            name: "list_files",
            description: "List files in the agent workspace",
            parameters: { type: "object", properties: {}, required: [] }
        }
    },
    read_file: {
        type: "function",
        function: {
            name: "read_file",
            description: "Read a file from the workspace",
            parameters: {
                type: "object",
                properties: { path: { type: "string", description: "Relative file path" } },
                required: ["path"]
            }
        }
    },
    write_file: {
        type: "function",
        function: {
            name: "write_file",
            description: "Create or update a workspace file",
            parameters: {
                type: "object",
                properties: { path: { type: "string" }, content: { type: "string" } },
                required: ["path", "content"]
            }
        }
    },
    search_memory: {
        type: "function",
        function: {
            name: "search_memory",
            description: "Search an agent's memory (uploaded files) for relevant information",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string" },
                    limit: { type: "number" }
                },
                required: ["query"]
            }
        }
    },
    mongo_find: {
        type: "function",
        function: {
            name: "mongo_find",
            description:
                "Read-only query against an allowed MongoDB collection. Returns up to 20 documents.",
            parameters: {
                type: "object",
                properties: {
                    collection: { type: "string", description: "Allowed collection name" },
                    filter: { type: "object", description: "MongoDB filter, default {}" },
                    projection: { type: "object", description: "Fields to include/exclude" },
                    sort: { type: "object", description: "Sort spec, e.g. {createdAt: -1}" },
                    limit: { type: "number", description: "Max documents (<= 20)" }
                },
                required: ["collection"]
            }
        }
    }
};

export type AgentToolbox = {
    tools: ToolDef[];
    execute: (name: string, args: any) => Promise<string>;
    close: () => Promise<void>;
};

const FILE_TOOLS = ["list_files", "read_file", "write_file"];

// File tools need a sandbox; without one (e.g. chat) they are not offered.
export async function createToolbox(
    agent: any,
    sandbox?: DockerSandboxManager
): Promise<AgentToolbox> {
    const workspace = sandbox ? createWorkspaceTools(sandbox) : undefined;
    const enabled: string[] = (agent.tools || []).filter(
        (name: string) => workspace || !FILE_TOOLS.includes(name)
    );
    const tools: ToolDef[] = enabled
        .filter(name => BUILTIN_TOOLS[name])
        .map(name => BUILTIN_TOOLS[name]);

    // Remote MCP tools, only when "mcp" is enabled.
    const mcp = enabled.includes("mcp")
        ? await connectMcpServers(agent.mcpServers || [])
        : { tools: [], close: async () => {} };
    const mcpByName = new Map(mcp.tools.map(tool => [tool.exposedName, tool]));

    for (const tool of mcp.tools) {
        tools.push({
            type: "function",
            function: {
                name: tool.exposedName,
                description: tool.description,
                parameters: tool.inputSchema
            }
        });
    }

    return {
        tools,

        async execute(name, args) {
            let result: unknown;

            const mcpTool = mcpByName.get(name);
            if (mcpTool) {
                result = await mcpTool.client.callTool({ name: mcpTool.remoteName, arguments: args });
            } else if (workspace && name === "list_files" && enabled.includes(name)) {
                result = await workspace.listFiles();
            } else if (workspace && name === "read_file" && enabled.includes(name)) {
                result = await workspace.readFile(args.path);
            } else if (workspace && name === "write_file" && enabled.includes(name)) {
                result = await workspace.writeFile(args.path, args.content);
            } else if (name === "search_memory" && enabled.includes(name)) {
                result = await searchMemory(String(agent._id), args.query, Math.min(Number(args.limit) || 5, 10));
            } else if (name === "mongo_find" && enabled.includes(name)) {
                result = await mongoFind(agent, args);
            } else {
                throw new Error(`Unknown tool: ${name}`);
            }

            const text = JSON.stringify(result);
            return text.length > MAX_TOOL_RESULT_CHARS
                ? text.slice(0, MAX_TOOL_RESULT_CHARS) + "...[truncated]"
                : text;
        },

        async close() {
            await mcp.close();
        }
    };
}
