import { app, BrowserWindow } from "electron";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const host = "127.0.0.1";
const port = 4317;
const dashboardUrl = `http://${host}:${port}`;
const projectRoot = path.dirname(fileURLToPath(import.meta.url));
let serverProcess = null;
let miniWindow = null;

function startServer() {
  serverProcess = spawn(process.execPath, [path.join(projectRoot, "server.mjs")], {
    cwd: projectRoot,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", HOST: host, PORT: String(port) },
    stdio: ["inherit", "inherit", "inherit", "ipc"],
  });
  serverProcess.on("message", (message) => {
    if (message?.type === "open-mini-quota") openMiniWindow();
  });
  serverProcess.once("exit", (code, signal) => {
    if (!app.isQuitting) {
      console.error(`Dashboard server stopped (${code ?? signal}).`);
      app.quit();
    }
  });
}

function openMiniWindow() {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.show();
    miniWindow.focus();
    return;
  }
  miniWindow = new BrowserWindow({
    width: 410,
    height: 180,
    resizable: true,
    minimizable: true,
    maximizable: false,
    backgroundColor: "#101311",
    alwaysOnTop: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  miniWindow.setAlwaysOnTop(true);
  miniWindow.on("closed", () => { miniWindow = null; });
  void miniWindow.loadURL(`${dashboardUrl}/mini.html`);
}

app.whenReady().then(() => {
  app.dock?.hide();
  startServer();
});

app.on("before-quit", () => {
  app.isQuitting = true;
  serverProcess?.kill();
});
