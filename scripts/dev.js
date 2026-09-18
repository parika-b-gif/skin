import { spawn } from "node:child_process";

console.log("\x1b[36m%s\x1b[0m", "=================================================");
console.log("\x1b[36m%s\x1b[0m", "  LUMA Skincare Full-Stack Application Runner   ");
console.log("\x1b[36m%s\x1b[0m", "=================================================");
console.log("\x1b[33m%s\x1b[0m", "• Starting Backend: Express API (http://localhost:3001)");
console.log("\x1b[32m%s\x1b[0m", "• Starting Frontend: Vite Client (http://localhost:5173)");

const server = spawn("node", ["--watch", "server/index.js"], {
  stdio: ["inherit", "pipe", "pipe"],
  env: process.env,
});

const client = spawn("npx", ["vite", "--host", "--port", "5173"], {
  stdio: ["inherit", "pipe", "pipe"],
  env: process.env,
});

function prefixStream(stream, prefix, color) {
  stream.on("data", (data) => {
    const lines = data.toString().split("\n");
    for (const line of lines) {
      if (line.trim()) {
        console.log(`${color}${prefix}\x1b[0m ${line}`);
      }
    }
  });
}

prefixStream(server.stdout, "[API]   ", "\x1b[33m");
prefixStream(server.stderr, "[API-ERR]", "\x1b[31m");
prefixStream(client.stdout, "[CLIENT]", "\x1b[32m");
prefixStream(client.stderr, "[CLIENT-ERR]", "\x1b[31m");

function shutdown() {
  console.log("\nShutting down full-stack services...");
  try {
    server.kill();
  } catch {}
  try {
    client.kill();
  } catch {}
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
