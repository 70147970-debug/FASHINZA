/**
 * `npm run mern:dev` (repository root): runs the API (node --watch, port 4000) and the Vite client (port 5173,
 * proxying /api to the API) side by side, with prefixed output. Ctrl+C stops both; if either exits, the other
 * is stopped too. No extra dependency: it simply starts the two workspace `dev` scripts.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const tasks = [
  { name: "server", color: "\x1b[36m", workspace: "@fashinza/server" },
  { name: "client", color: "\x1b[35m", workspace: "@fashinza/client" },
];

const children = [];
let stopping = false;

function pipe(stream, out, prefix) {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) out.write(`${prefix} ${line}\n`);
  });
  stream.on("end", () => {
    if (buffer) out.write(`${prefix} ${buffer}\n`);
  });
}

function kill(child, signal) {
  try {
    if (process.platform === "win32") child.kill(signal);
    else process.kill(-child.pid, signal); // the whole group: npm, its shell and the node process
  } catch {
    // already gone
  }
}

function stopAll(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) kill(child, "SIGTERM");
  setTimeout(() => {
    for (const child of children) kill(child, "SIGKILL");
    process.exit(code);
  }, 5000).unref();
}

for (const task of tasks) {
  const prefix = `${task.color}[${task.name}]\x1b[0m`;
  // Each task runs in its own process group (POSIX) so stopping it also stops what npm started under it.
  const child = spawn(npm, ["run", "dev", "--workspace", task.workspace], {
    cwd: root,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });
  pipe(child.stdout, process.stdout, prefix);
  pipe(child.stderr, process.stderr, prefix);
  child.on("exit", (code, signal) => {
    if (!stopping) console.log(`${prefix} exited (${signal ?? code}); stopping the other process.`);
    stopAll(code ?? 0);
    if (children.every((c) => c.exitCode !== null || c.signalCode !== null)) {
      for (const c of children) kill(c, "SIGTERM"); // stragglers left in a group after npm exited
      process.exit(code ?? 0);
    }
  });
  children.push(child);
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
