
import Docker from "dockerode";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const docker = new Docker();

export class DockerSandboxManager {
  private container: Docker.Container | null = null;
  private readonly timeout =
    Number(process.env.DOCKER_TIMEOUT || 300000);

  async create(agentId: string, executionId: string) {
    const workspaceRoot = path.resolve(
      process.env.WORKSPACE_ROOT || "./workspaces"
    );

    const workspace = path.join(
      workspaceRoot,
      agentId,
      executionId
    );

    await fs.mkdir(workspace, {
      recursive: true,
      mode: 0o700
    });

    const containerName =
      `agents-hub-${randomUUID()}`;

    const memory = Number(
      process.env.DOCKER_MEMORY || 536870912
    );

    const cpus = Number(
      process.env.DOCKER_CPUS || 1
    );

    this.container = await docker.createContainer({
      name: containerName,
      Image: process.env.DOCKER_IMAGE || "node:22-alpine",

      Cmd: [
        "sh",
        "-c",
        "while true; do sleep 3600; done"
      ],

      WorkingDir: "/workspace",

      Tty: true,
      OpenStdin: false,

      Labels: {
        "app": "agents-hub",
        "agent": agentId,
        "execution": executionId
      },

      HostConfig: {
        Binds: [
          `${workspace}:/workspace:rw`
        ],

        NetworkMode: "none",

        Memory: memory,
        NanoCpus: Math.floor(cpus * 1e9),
        PidsLimit: 128,

        ReadonlyRootfs: true,

        CapDrop: ["ALL"],

        SecurityOpt: [
          "no-new-privileges:true"
        ],

        Tmpfs: {
          "/tmp": "rw,noexec,nosuid,size=64m"
        },

        RestartPolicy: {
          Name: "no"
        }
      }
    });

    await this.container.start();

    return {
      containerId: this.container.id,
      workspace
    };
  }

  async execute(command: string[]) {
    if (!this.container) {
      throw new Error("Sandbox not initialized");
    }

    if (
      !Array.isArray(command) ||
      command.length === 0 ||
      command.some(arg => typeof arg !== "string")
    ) {
      throw new Error("Invalid command");
    }

    const exec = await this.container.exec({
      Cmd: command,
      WorkingDir: "/workspace",
      AttachStdout: true,
      AttachStderr: true,
      Tty: true
    });

    const stream = await exec.start({
      hijack: true,
      stdin: false,
      Tty: true
    });

    let output = "";

    stream.on("data", chunk => {
      output += chunk.toString();
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        stream.destroy(
          new Error("Command execution timed out")
        );
      }, this.timeout);

      stream.on("end", () => {
        clearTimeout(timer);
        resolve();
      });

      stream.on("error", error => {
        clearTimeout(timer);
        reject(error);
      });
    });

    const status = await exec.inspect();

    return {
      output,
      exitCode: status.ExitCode
    };
  }

  async destroy() {
    if (!this.container) return;

    try {
      await this.container.stop({ t: 2 });
    } catch {
      // Container may already be stopped.
    }

    try {
      await this.container.remove({ force: true });
    } catch {
      // Container may already be removed.
    }

    this.container = null;
  }
}
