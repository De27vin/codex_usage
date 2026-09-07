export function desktopAddress(env = process.env) {
  const host = env.HOST || "127.0.0.1";
  const port = Number(env.PORT || 4317);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be an integer between 1 and 65535.");
  const connectHost = host === "0.0.0.0" ? "127.0.0.1" : host === "::" ? "::1" : host;
  return { host, port, url: `http://${connectHost.includes(":") ? `[${connectHost}]` : connectHost}:${port}` };
}

export function miniPreferences(input = {}) {
  const weekly = input.weekly !== false && input.weekly !== "0";
  const fiveHour = (input.fiveHour !== false && input.fiveHour !== "0") || !weekly;
  const result = { fiveHour: fiveHour ? "1" : "0", weekly: weekly ? "1" : "0" };
  if (["local", "centralized"].includes(input.source)) result.source = input.source;
  if (typeof input.language === "string" && /^[a-z]{2}(-[A-Za-z]{2})?$/.test(input.language)) result.language = input.language;
  if (["green", "blue", "violet", "amber"].includes(input.theme)) result.theme = input.theme;
  return result;
}
