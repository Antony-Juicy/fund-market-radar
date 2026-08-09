import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import test from "node:test";

test(
  "web runtime serves the real MCP hello result",
  { timeout: 8_000 },
  async () => {
    const child = spawn(
      process.execPath,
      [resolve(process.cwd(), "build/src/web-server.js")],
      {
        cwd: process.cwd(),
        env: { ...process.env, PORT: "0" },
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    let stdout = "";
    let stderr = "";

    const baseUrl = await new Promise<string>((resolveUrl, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Web runtime did not become ready. stderr: ${stderr}`));
      }, 4_000);

      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
        const match = stdout.match(/Web demo ready at (http:\/\/127\.0\.0\.1:\d+)/);

        if (match?.[1]) {
          clearTimeout(timeout);
          resolveUrl(match[1]);
        }
      });
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });
      child.once("exit", (code) => {
        clearTimeout(timeout);
        reject(new Error(`Web runtime exited before ready with code ${code}.`));
      });
    });

    try {
      const response = await fetch(`${baseUrl}/api/hello?name=Tony`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { text: "你好，Tony!" });
    } finally {
      if (child.exitCode === null) {
        child.kill("SIGTERM");
        await once(child, "exit");
      }
    }
  }
);
