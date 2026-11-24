const { spawn } = require("child_process");
const electron = require("electron");

const child = spawn(electron, ["."], {
  stdio: "inherit",
  env: { ...process.env, ORBIT_DEV_URL: "http://localhost:5174" },
});
child.on("exit", (code) => process.exit(code ?? 0));
