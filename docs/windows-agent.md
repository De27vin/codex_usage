# Supervise the reporting agent on Windows

The supported Windows setup runs `agent.mjs` behind a persistent PowerShell supervisor and a per-user Task Scheduler task named `CodexUsageMesh` by default. It is designed for laptops that sleep for long periods: the supervisor survives an ordinary sleep, the task is also triggered by the Windows resume event, and a non-zero Node.js exit is restarted after 30 seconds.

The installer operates only on the local scheduled task and local files. It never calls the hub administration or revocation APIs, so installing, updating, or uninstalling one PC does not delete or change any other registered machine.

## Prerequisites

- Windows 10 or Windows 11;
- Node.js 20 or newer available to the current user;
- this repository checked out locally;
- the same Windows user that owns the local Codex session data;
- either an existing `.cache\mesh-agent.json` association or a fresh one-time association code.

Run the commands from the repository root in PowerShell. Administrator elevation is not intended: the task uses the current interactive user and `LeastPrivilege`.

## Install an already-associated machine

For a machine such as `HQVISSI-LAP19` where `.cache\mesh-agent.json` already contains the working association:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\Install-CodexUsageMesh.ps1 -Action Install
```

The command:

1. stops only the local task named `CodexUsageMesh` if it already exists;
2. refuses to continue if another matching supervisor or Node agent is still running;
3. copies the legacy state once to `%LOCALAPPDATA%\CodexUsageMesh\mesh-agent.windows.json` when the installed state does not exist;
4. never overwrites an installed state during later runs;
5. generates `.cache\windows-agent\CodexUsageMesh.Supervisor.ps1` in the repository without an association code or infrastructure credential, avoiding Windows policies that block scheduled scripts from `AppData`;
6. registers and starts the current user's task.

The original state file is retained. After supervision is installed, do not start a second `npm run start:agent` process from the repository. The scheduled task is the owner of the reporting process.

## Install and associate a new machine

Create a one-time code under the central Site's `/admin` page, then immediately run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\Install-CodexUsageMesh.ps1 `
  -Action Install `
  -HubUrl "https://codex-usage-mesh-ingress.capitainegreenpearl.workers.dev" `
  -AssociationCode "AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-0000-1111"
```

The installer performs one synchronous enrollment and synchronization before creating the supervised task. The one-time code appears only in that initial process invocation; it is not written to the task, launcher, state, or logs. Later starts load the hub URL and Ed25519 identity from the state file.

Use `-Alias "Nom lisible"` only on the first association. Otherwise the Windows hostname is used. Privacy remains `hash` with titles excluded by default; the explicit alternatives are `-ProjectMode basename|full` and `-IncludeTitles`.

## Task and recovery behavior

`CodexUsageMesh` has two triggers:

- opening a session for the installing Windows user;
- Windows `Microsoft-Windows-Power-Troubleshooter` event ID 1, emitted after resume from sleep.

The task uses `MultipleInstancesPolicy=IgnoreNew`, unlimited execution time, `StartWhenAvailable`, and Task Scheduler restart-on-failure. The generated supervisor adds a named mutex as a second singleton boundary. A resume trigger cannot create a parallel supervisor when the logon instance is still alive.

The supervisor launches the repository's current `agent.mjs`. When Node exits with a non-zero code, it logs the code and restart number, waits 30 seconds, and launches it again. A zero exit is treated as an intentional stop and is not looped.

Logs are UTF-8 without BOM, with an ISO-8601 timestamp on every line:

```powershell
Get-Content "$env:LOCALAPPDATA\CodexUsageMesh\logs\supervisor.log" -Wait
```

## Diagnose

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\Install-CodexUsageMesh.ps1 -Action Diagnose
```

The diagnostic verifies and reports:

- task presence, current state, last result, logon trigger, and resume trigger;
- exactly one supervisor and one matching Node agent process;
- enrolled state path and persisted hub URL;
- `lastSyncAt`, its age, and whether it is newer than five minutes;
- public ingress `/healthz` reachability and HTTP status;
- supervisor log path.

It exits with code `0` only when all checks are healthy, otherwise with code `1`. Use `-MaxSyncAgeMinutes N` to change only the freshness threshold for a slow or intermittently connected machine.

After a sleep/resume test, wait for the next collector interval and rerun the diagnostic. `LastSyncAt` must advance while the task remains `Running`. A non-zero exit can be confirmed in the log by an `agent exited; exitCode=...` line followed by `agent restart scheduled; restartAttempt=...` and a new launch.

## Update the repository and supervisor

Update the intended branch, then refresh the generated launcher and task:

```powershell
git switch develop
git pull --ff-only origin develop
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\Install-CodexUsageMesh.ps1 -Action Update
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\Install-CodexUsageMesh.ps1 -Action Diagnose
```

`Update` stops and replaces only the local task definition. The installed state file is detected before the legacy source and is never overwritten, so the node ID, private signing key, sequence, alias, `lastSyncAt`, and hub URL survive. No new association code is needed.

If the checkout moved, run `Update` from the new checkout. The task and launcher will point to the new repository path while continuing to use the same state under `%LOCALAPPDATA%`.

## Uninstall local supervision

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\Install-CodexUsageMesh.ps1 -Action Uninstall
```

This stops and unregisters only `CodexUsageMesh` and removes only the generated supervisor file. It deliberately keeps the state and logs under `%LOCALAPPDATA%\CodexUsageMesh`, and it does not revoke or delete any hub node. Reinstalling later therefore uses the same association.

For permanent removal, first revoke this exact machine from `/admin`. Only after checking the exact local target should its retained state be deleted. Revocation and state deletion are intentionally separate from the normal uninstall command.

## Troubleshooting

- **The task is `Ready` instead of `Running`:** inspect the final supervisor log lines. A missing repository, Node executable, or state makes the supervisor exit non-zero and Task Scheduler retries it.
- **The task is running but `AgentProcessCount` is zero:** the supervisor may be inside its 30-second backoff. The log contains the exit code and next attempt.
- **The hub is unreachable:** verify the public ingress URL ending in `/healthz`; never configure the private Site URL or a Sites authorization token on a reporting machine.
- **The state is reported incomplete:** the installer leaves it untouched. Restore the correct existing file or revoke only that machine and perform a deliberate new association.
- **An instance is still active during update:** stop the manually launched Node/PowerShell process. The installer refuses to kill a process it cannot prove belongs to the task.
