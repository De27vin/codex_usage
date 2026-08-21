import path from "node:path";
import { fileURLToPath } from "node:url";
import { AGENT_HELP, parseAgentOptions } from "./src/agent-options.mjs";
import { createUsageCollector } from "./src/usage-collector.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const options = parseAgentOptions(process.argv.slice(2));
if (options.help) {
  console.log(AGENT_HELP);
  process.exit(0);
}
const collector = await createUsageCollector({ root, env: options.env });

if (!collector.meshAgent) {
  throw new Error("Cette machine n’est pas encore associée. Copiez la commande générée dans la page /admin.");
}

collector.start({ unrefTimer: false });
await collector.refresh();
console.log(`Collecteur Codex actif pour ${collector.meshAgent.status().alias}. Aucune interface locale n’est servie.`);

function shutdown() {
  collector.stop();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
