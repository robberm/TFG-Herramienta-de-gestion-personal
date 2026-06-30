const { spawn } = require("child_process");

process.env.ELECTRON_SKIP_BACKEND = "1";

const electronBinary = require("electron");
const child = spawn(electronBinary, ["."], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
