#!/usr/bin/env node
"use strict";

const { spawn } = require("child_process");

const child = spawn("npx", ["-y", "@decodo/mcp-server"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

child.on("exit", code => process.exit(code ?? 0));
child.on("error", err => {
  console.error("Failed to start @decodo/mcp-server:", err);
  process.exit(1);
});
