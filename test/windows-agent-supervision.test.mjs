import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  generateWindowsSupervisor,
  preserveExistingAgentState,
  supervisorMutexName,
  writeWindowsSupervisor,
} from "../src/windows-agent-supervision.mjs";

test("Windows supervisor generation embeds safe paths and restart guarantees without enrollment secrets", () => {
  const script = generateWindowsSupervisor({
    repoRoot: "C:\\Users\\O'Brien\\codex_usage",
    statePath: "C:\\Users\\O'Brien\\AppData\\Local\\CodexUsageMesh\\state\\mesh-agent.json",
    nodePath: "C:\\Program Files\\nodejs\\node.exe",
    logPath: "C:\\Users\\O'Brien\\AppData\\Local\\CodexUsageMesh\\logs\\supervisor.log",
    taskName: "CodexUsageMesh",
    restartDelaySeconds: 30,
  });

  assert.match(script, /O''Brien/);
  assert.match(script, /System\.Text\.UTF8Encoding\(\$false\)/);
  assert.match(script, /try \{ \[Console\]::OutputEncoding = \$Utf8NoBom \} catch \{\}/);
  assert.match(script, /exitCode=\$exitCode/);
  assert.match(script, /restartAttempt=\$restartAttempt/);
  assert.match(script, /Start-Sleep -Seconds \$RestartDelaySeconds/);
  assert.match(script, /WaitOne\(0, \$false\)/);
  assert.match(script, /\$env:MESH_HUB_URL = \$null/);
  assert.match(script, /\$env:MESH_ENROLLMENT_CODE = \$null/);
  assert.doesNotMatch(script, /AAAA-BBBB|--associate/);
  assert.equal(supervisorMutexName("CodexUsageMesh"), supervisorMutexName("CodexUsageMesh"));
});

test("existing Mesh state is copied once and never overwritten during an update", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-windows-state-"));
  const sourcePath = path.join(directory, "legacy", "mesh-agent.json");
  const destinationPath = path.join(directory, "installed", "state", "mesh-agent.json");
  const sourceState = JSON.stringify({
    nodeId: "node-existing",
    alias: "WINDOWS-LAPTOP",
    sequence: 42,
    lastSyncAt: "2026-08-25T07:30:00.000Z",
    privateKey: "private-existing",
    hubUrl: "https://mesh.example",
  });
  const installedState = JSON.stringify({ nodeId: "node-installed", privateKey: "private-installed", hubUrl: "https://mesh.example" });

  await mkdir(path.dirname(sourcePath), { recursive: true });
  await writeFile(sourcePath, sourceState, "utf8");

  const first = await preserveExistingAgentState({ sourcePath, destinationPath });
  assert.equal(first.status, "copied");
  assert.equal(await readFile(destinationPath, "utf8"), sourceState);
  assert.equal(await readFile(sourcePath, "utf8"), sourceState);

  await writeFile(destinationPath, installedState, "utf8");
  await writeFile(sourcePath, JSON.stringify({ nodeId: "node-new-source" }), "utf8");
  const update = await preserveExistingAgentState({ sourcePath, destinationPath });
  assert.equal(update.status, "existing");
  assert.equal(await readFile(destinationPath, "utf8"), installedState);
});

test("Windows installer migrates the previous supervised state without publishing owner-specific examples", async () => {
  const installer = await readFile(new URL("../scripts/windows/Install-CodexUsageMesh.ps1", import.meta.url), "utf8");
  const documentation = await readFile(new URL("../docs/windows-agent.md", import.meta.url), "utf8");

  assert.match(installer, /previousInstalledStatePath = Join-Path \$resolvedInstall 'state\\mesh-agent\.json'/);
  assert.match(installer, /Test-Path -LiteralPath \$previousInstalledStatePath -PathType Leaf/);
  assert.match(installer, /LegacyStatePath = \$legacyStatePath/);
  assert.match(documentation, /https:\/\/your-mesh-ingress\.example/);
  assert.doesNotMatch(documentation, /capitainegreenpearl/);
});

test("Windows supervisor logs a non-zero exit and restarts the agent once", { skip: process.platform !== "win32" }, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-windows-restart-"));
  const launcherPath = path.join(directory, "supervisor.ps1");
  const statePath = path.join(directory, "state", "mesh-agent.json");
  const logPath = path.join(directory, "logs", "supervisor.log");
  const counterPath = path.join(directory, "launch-count.txt");
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify({
    nodeId: "node-test",
    alias: "Test Windows",
    hubUrl: "https://mesh.example",
    privateKey: "test-private-key",
  }), "utf8");
  await writeFile(path.join(directory, "agent.mjs"), `
import { readFile, writeFile } from "node:fs/promises";
const counterPath = ${JSON.stringify(counterPath)};
let count = 0;
try { count = Number(await readFile(counterPath, "utf8")); } catch {}
count += 1;
await writeFile(counterPath, String(count), "utf8");
console.log(\`dummy launch \${count}\`);
process.exit(count === 1 ? 1 : 0);
`, "utf8");
  await writeWindowsSupervisor(launcherPath, {
    repoRoot: directory,
    statePath,
    nodePath: process.execPath,
    logPath,
    taskName: `CodexUsageMesh-Test-${process.pid}`,
    restartDelaySeconds: 1,
  });

  const powershell = path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const result = spawnSync(powershell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", launcherPath], {
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(counterPath, "utf8"), "2");
  const log = await readFile(logPath, "utf8");
  assert.match(log, /^\[\d{4}-\d{2}-\d{2}T/m);
  assert.match(log, /agent exited; exitCode=1/);
  assert.match(log, /agent restart scheduled; restartAttempt=1; nextLaunchAttempt=2; delaySeconds=1/);
  assert.match(log, /agent launch; attempt=2/);
  assert.match(log, /agent exited; exitCode=0/);
});
