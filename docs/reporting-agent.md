# Install a reporting agent

The reporting agent lets a Windows, macOS, or Linux machine contribute its local Codex usage to a central dashboard. It analyzes session metadata locally, removes fields that are not allowed in the Mesh payload, signs the minimized snapshot with a machine-generated Ed25519 key, and sends it only to the configured hub.

This is not an autonomous Codex AI agent. It cannot run tasks, receive instructions from the hub, or read arbitrary files.

## Choose how the machine should run

| Mode | Command or image | Local interface | Reports to the hub |
| --- | --- | --- | --- |
| GUI plus agent | `npm start` or the dashboard container | Yes, on port 4317 | Yes |
| Headless agent | `npm run start:agent` or Docker target `agent` | No | Yes |

Both modes use the same collector, privacy filter, signing identity, enrollment, and synchronization protocol.

## Prerequisites

Each machine needs:

- Codex session data under its local Codex directory;
- Node.js 20 or newer, or Docker;
- network access to the central hub over HTTPS when it is not local;
- a one-time enrollment code created by the hub owner;
- for a private OpenAI Site, its machine bypass token;
- a persistent writable location for the agent state file.

The agent never needs an OpenAI API key and must never be given `auth.json`.

## 1. Create a one-time enrollment code

For an OpenAI Sites hub:

1. sign in to the deployed Site;
2. open `/admin`;
3. select **Add a machine**;
4. copy the generated enrollment code.

The code expires after ten minutes and can be used once. Create it only when the target machine is ready.

For a self-hosted hub, create the code through the administrator endpoint documented in the root [README](../README.md#self-hosted-central-hub).

## 2. Install from source with Node.js

Clone the repository on the machine:

```bash
git clone https://github.com/capisoft-lib/codex_usage.git
cd codex_usage
```

The root runtime has no third-party npm runtime dependencies. It reads the current user's Codex directory by default.

Set the hub information in the process environment. Example for Windows PowerShell:

```powershell
$env:MESH_HUB_URL = "https://your-site.example"
$env:MESH_NODE_ALIAS = "Office PC"
$env:MESH_ENROLLMENT_CODE = "AAAA-BBBB-CCCC-DDDD"
$env:MESH_AGENT_STATE_PATH = "$env:LOCALAPPDATA\CodexUsageDashboard\mesh-agent.json"
$env:MESH_PROJECT_MODE = "hash"
$env:MESH_INCLUDE_TITLES = "false"

npm run start:agent
```

Example for macOS or Linux:

```bash
export MESH_HUB_URL="https://your-site.example"
export MESH_NODE_ALIAS="Office PC"
export MESH_ENROLLMENT_CODE="AAAA-BBBB-CCCC-DDDD"
export MESH_AGENT_STATE_PATH="$HOME/.local/state/codex-usage-dashboard/mesh-agent.json"
export MESH_PROJECT_MODE="hash"
export MESH_INCLUDE_TITLES="false"

npm run start:agent
```

For a private OpenAI Site, also set `MESH_SITES_BYPASS_TOKEN` in the process environment. Treat it as a secret and do not put it in source code, a committed file, terminal screenshots, or support messages.

Use `npm start` instead of `npm run start:agent` when the machine should also expose its local dashboard at [http://127.0.0.1:4317](http://127.0.0.1:4317).

## 3. Verify enrollment

A successful first run:

1. creates the persistent state file and its private signing key;
2. exchanges the one-time code for a hub node identity;
3. synchronizes a minimized snapshot;
4. prints a synchronization message;
5. shows the machine as active under the Site's `/admin` page.

After this succeeds, remove `MESH_ENROLLMENT_CODE` from the machine's persistent configuration. The state file replaces it for future starts.

Protect `MESH_AGENT_STATE_PATH`. Deleting it creates a new signing identity and requires a fresh enrollment. Copying it to another machine would duplicate a trusted identity and must not be done.

## 4. Keep the agent running

First run the agent interactively and verify enrollment. Then configure the command through the operating system's service manager:

- Windows: Task Scheduler or a managed Windows service;
- macOS: `launchd`;
- Linux: `systemd` or another supervised service.

Run it as the same user that owns the Codex session directory, give it write access only to its state/cache directory, and store secrets using the operating system's protected service configuration. Do not run it as an administrator or root unless the local environment makes that unavoidable.

## Docker operation

The existing Compose service runs the GUI and agent together whenever `MESH_HUB_URL` is present. Copy `.env.example` to the ignored `.env`, configure `CODEX_DATA_PATH` and the required `MESH_*` values, then run:

```bash
docker compose up -d --build
docker compose logs -f dashboard
```

After successful enrollment, remove `MESH_ENROLLMENT_CODE` from `.env` and recreate the service:

```bash
docker compose up -d
```

The named `codex-usage-dashboard-storage` volume preserves both the derived snapshot and the signing identity. Do not use `docker compose down -v` unless the machine is being deliberately unenrolled and its cached state may be deleted.

For a headless Docker image built from source:

```bash
docker build --target agent -t codex-usage-agent:local .
```

Run it with:

- the local `sessions/` and `archived_sessions/` directories mounted read-only;
- `session_index.jsonl` mounted read-only;
- a persistent volume mounted at `/app-cache`;
- `MESH_AGENT_STATE_PATH=/app-cache/mesh-agent.json`;
- the same `MESH_HUB_URL`, enrollment, privacy, and optional Site bypass settings used by the Node.js process;
- no published HTTP port.

## Privacy settings

Recommended defaults are:

```text
MESH_PROJECT_MODE=hash
MESH_INCLUDE_TITLES=false
```

Project modes:

- `hash` sends a stable machine-local pseudonym for each project;
- `basename` sends only the final project-directory name;
- `full` sends the full project identity and should be enabled only after an explicit privacy decision.

Enabling `MESH_INCLUDE_TITLES` permits sanitized conversation titles to leave the machine. Leave it disabled unless those titles are needed and their disclosure has been reviewed.

The Mesh payload excludes raw JSONL, prompts, responses, reasoning, tool output, credentials, usernames, and full local paths by default.

## Update an agent

For a source installation:

1. stop the supervised process;
2. preserve the agent state file;
3. update to the intended release or commit;
4. run `npm test`;
5. restart and confirm a successful synchronization.

For Docker, rebuild or pull the intended image, recreate the container while retaining the named state volume, and check its logs and `/admin` status.

Keep agents and the central hub on compatible Mesh protocol versions during schema or protocol upgrades.

## Revoke, remove, or replace a machine

To stop future access, revoke the machine from the hub's `/admin` page first. Then stop and remove the local process or container. The local state file can be retained for diagnosis, or deleted after revocation when permanent removal is intended.

If the state file is lost or corrupted:

1. revoke the previous machine identity in `/admin`;
2. move the unreadable state file out of the configured path;
3. create a new one-time enrollment code;
4. start the agent again and verify the replacement identity.

## Troubleshooting

### The agent says that `MESH_HUB_URL` is required

The headless command does not run in local-only mode. Set the exact hub base URL, without an API path.

### The enrollment code is rejected

Generate a new code from `/admin`, confirm that it has not expired or already been used, and verify the machine clock.

### A private Site rejects the request

Set the Site's machine bypass token as `MESH_SITES_BYPASS_TOKEN`. It crosses the private Site access barrier but does not replace the one-time enrollment or signed Mesh protocol.

### The machine enrolls again after every restart

`MESH_AGENT_STATE_PATH` is not persistent or writable. Preserve that exact file across restarts and container replacements.

### No new data appears

Confirm that the process is still running, the local Codex sources are readable, the hub is reachable, and `/admin` shows a recent machine update. Keep the source directories read-only; do not broaden access to the entire `.codex` directory.
