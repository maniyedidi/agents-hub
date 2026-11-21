import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export type McpTool = {
    exposedName: string;
    remoteName: string;
    description: string;
    inputSchema: any;
    client: Client;
};

function safeName(value: string) {
    return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32);
}

// Connects to remote (HTTP) MCP servers; unreachable servers are skipped.
export async function connectMcpServers(servers: any[]) {
    const clients: Client[] = [];
    const tools: McpTool[] = [];

    for (const server of servers) {
        try {
            const url = new URL(server.url);
            if (url.protocol !== "https:" && url.protocol !== "http:") continue;

            const client = new Client({ name: "agents-hub", version: "1.0.0" });
            const headers: Record<string, string> = {};
            if (server.authToken) headers.Authorization = `Bearer ${server.authToken}`;

            await client.connect(
                new StreamableHTTPClientTransport(url, { requestInit: { headers } })
            );
            clients.push(client);

            const { tools: remoteTools } = await client.listTools();
            for (const remote of remoteTools) {
                tools.push({
                    exposedName: `mcp_${safeName(server.name)}_${safeName(remote.name)}`,
                    remoteName: remote.name,
                    description: remote.description || remote.name,
                    inputSchema: remote.inputSchema,
                    client
                });
            }
        } catch (error) {
            console.error(`MCP server "${server.name}" unavailable:`, error);
        }
    }

    return {
        tools,
        close: () => Promise.allSettled(clients.map(client => client.close()))
    };
}
