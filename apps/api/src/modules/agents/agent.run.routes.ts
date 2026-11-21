import { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { AgentModel } from "./agent.model";
import { runAgent } from "./agent.runner";
import { DockerSandboxManager } from "../../sandbox/docker-manager";

export async function agentRunRoutes(app: FastifyInstance) {
  app.post("/api/agents/run", async (request, reply) => {
    const body = (request.body || {}) as {
      name?: string;
      task?: string;
    };

    const executionId = randomUUID();
    const sandbox = new DockerSandboxManager();

    try {
      const agent = await AgentModel.findOne({ name: body.name, enabled: true })
        .select("+mcpServers.authToken")
        .lean();

      if (!agent) {
        return reply.code(404).send({ error: "Agent not found" });
      }

      const container = await sandbox.create("coder", executionId);

      request.log.info({
        executionId,
        containerId: container.containerId,
        workspace: container.workspace
      }, "Agent sandbox created");

      const result = await runAgent(agent, body.task || "No task provided", sandbox);

      return {
        executionId,
        containerId: container.containerId,
        ...result
      };
    } catch (error) {
      request.log.error(error);

      return reply.code(500).send({
        executionId,
        error: error instanceof Error
          ? error.message
          : "Agent execution failed"
      });
    } finally {
      await sandbox.destroy();
      request.log.info({ executionId }, "Sandbox cleaned up");
    }
  });
}
