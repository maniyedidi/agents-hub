

import path from "node:path";
import { DockerSandboxManager } from "../../sandbox/docker-manager";

const WORKSPACE = path.resolve("workspace");

export function createWorkspaceTools(
  sandbox: DockerSandboxManager
) {
  return {
    async listFiles() {
      return sandbox.execute([
        "find",
        "/workspace",
        "-maxdepth",
        "3",
        "-type",
        "f"
      ]);
    },

    async readFile(filePath: string) {
      return sandbox.execute([
        "node",
        "-e",
        `
          const fs = require("fs");
          const path = require("path");

          const root = "/workspace";
          const target = path.resolve(root, process.argv[1]);

          if (!target.startsWith(root + "/")) {
            throw new Error("Invalid workspace path");
          }

          process.stdout.write(fs.readFileSync(target, "utf8"));
        `,
        filePath
      ]);
    },

    async writeFile(
      filePath: string,
      content: string
    ) {
      const encoded = Buffer.from(content).toString("base64");

      return sandbox.execute([
        "node",
        "-e",
        `
          const fs = require("fs");
          const path = require("path");

          const root = "/workspace";
          const target = path.resolve(root, process.argv[1]);

          if (!target.startsWith(root + "/")) {
            throw new Error("Invalid workspace path");
          }

          fs.mkdirSync(path.dirname(target), {
            recursive: true
          });

          fs.writeFileSync(
            target,
            Buffer.from(process.argv[2], "base64")
          );

          console.log("File created:", target);
        `,
        filePath,
        encoded
      ]);
    }
  };
}

