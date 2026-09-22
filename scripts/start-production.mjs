import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "./sites-env.mjs";

// Wrangler resolves relative env files from dist/server; use the source root.
const envFile = path.join(projectRoot, ".dev.vars");
const child = spawn(
  process.execPath,
  [
    path.join(projectRoot, "node_modules/wrangler/bin/wrangler.js"),
    "dev",
    "--config",
    "dist/server/wrangler.json",
    ...(existsSync(envFile) ? ["--env-file", envFile] : []),
    "--local",
    "--persist-to",
    ".wrangler/state",
    "--ip",
    "127.0.0.1",
    "--inspector-port",
    "0",
    ...process.argv.slice(2),
  ],
  { cwd: projectRoot, env: process.env, stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", () => {
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
