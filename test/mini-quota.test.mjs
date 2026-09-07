import assert from "node:assert/strict";
import test from "node:test";
import { weeklyQuotaPeriods, shortQuotaDisplay, quotaCountdownText } from "../public/quota-display.js";
import { createMiniData, selectMiniSource } from "../public/mini-data.js";
import { desktopAddress, miniPreferences } from "../src/desktop-options.mjs";

test("desktop preserves custom bind address and port, with connectable wildcard URLs", () => {
  assert.deepEqual(desktopAddress({ HOST: "0.0.0.0", PORT: "4328" }), { host: "0.0.0.0", port: 4328, url: "http://127.0.0.1:4328" });
  assert.equal(desktopAddress({ HOST: "::", PORT: "4329" }).url, "http://[::1]:4329");
  assert.equal(desktopAddress({ HOST: "localhost", PORT: "5000" }).url, "http://localhost:5000");
  for (const port of ["0", "65536", "oops", "4.5"]) assert.throws(() => desktopAddress({ PORT: port }));
});

test("native preferences retain a visible quota and allow only known source and theme values", () => {
  assert.deepEqual(miniPreferences({ fiveHour: "0", weekly: "0", source: "centralized", theme: "blue", language: "fr" }),
    { fiveHour: "1", weekly: "0", source: "centralized", theme: "blue", language: "fr" });
  assert.deepEqual(miniPreferences({ source: "https://elsewhere", theme: "invalid", language: "../../" }), { fiveHour: "1", weekly: "1" });
});

test("hosted mini uses centralized capabilities and local mini respects explicit source", () => {
  assert.equal(selectMiniSource({ apiVersion: 1, sources: ["centralized"], defaultSource: "centralized" }, "local"), "centralized");
  assert.equal(selectMiniSource({ apiVersion: 1, sources: ["local", "centralized"], defaultSource: "local" }, "centralized"), "centralized");
  assert.throws(() => selectMiniSource({ apiVersion: 1, sources: [] }, "local"));
});

test("mini and dashboard share weekly rollover, unknown short reset, and countdown boundaries", () => {
  const reset = "2026-09-07T12:00:00Z";
  const quota = { remainingPercent: 28, resetsAt: reset, observedAt: "2026-09-07T10:00:00Z" };
  const data = { weeklyQuotaHistory: [quota], fiveHourQuota: quota };
  const before = new Date(Date.parse(reset) - 1);
  assert.equal(weeklyQuotaPeriods(data, before)[0], quota);
  assert.equal(shortQuotaDisplay(quota, before).remainingPercent, 28);
  assert.match(quotaCountdownText(reset, "en-GB", before), /1s/);
  assert.equal(weeklyQuotaPeriods(data, new Date(reset))[0].theoretical, true);
  assert.equal(weeklyQuotaPeriods(data, new Date(reset))[0].remainingPercent, null);
  assert.equal(shortQuotaDisplay(quota, new Date(reset)).remainingPercent, null);
  assert.equal(shortQuotaDisplay({ remainingPercent: 12, resetsAt: null }).remainingPercent, 12);
  assert.equal(shortQuotaDisplay(null).resetsAt, null);
  assert.equal(quotaCountdownText(null, "en-GB"), "");
});

test("connection loss preserves the snapshot timestamp, recovery replaces it", async () => {
  let fail = false;
  let time = 100;
  const model = createMiniData({ now: () => time, onChange() {}, fetchJson: async () => {
    if (fail) throw new Error("offline");
    return { weeklyQuota: { remainingPercent: time } };
  } });
  model.setSource("local");
  await model.load();
  fail = true; time = 200;
  await model.load();
  assert.equal(model.snapshot.error, true);
  assert.equal(model.snapshot.receivedAt, 100);
  assert.equal(model.snapshot.data.weeklyQuota.remainingPercent, 100);
  fail = false;
  await model.load();
  assert.equal(model.snapshot.error, false);
  assert.equal(model.snapshot.receivedAt, 200);
});

test("requests never overlap and a previous source cannot populate the new source", async () => {
  let release;
  const urls = [];
  const model = createMiniData({ onChange() {}, fetchJson: (url) => { urls.push(url); return new Promise((resolve) => { release = resolve; }); } });
  model.setSource("local");
  const first = model.load();
  const duplicate = model.load();
  assert.equal(urls.length, 1);
  model.setSource("centralized");
  release({ weeklyQuota: { remainingPercent: 99 } });
  await Promise.all([first, duplicate]);
  assert.equal(model.snapshot.data, null);
  const next = model.load();
  assert.match(urls[1], /source=centralized$/);
  release({ weeklyQuota: { remainingPercent: 20 } });
  await next;
  assert.equal(model.snapshot.data.weeklyQuota.remainingPercent, 20);
});
