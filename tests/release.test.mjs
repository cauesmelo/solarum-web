/** v1.0 release chores (docs/V1_RELEASE_PLAN.md S4, S10-S12, S14): the
 * version, the visible label, the in-game credits, the changelog, the itch
 * settings, a ZIP that carries player docs only, and a save that survives
 * every shape of old or damaged data. The release gate re-checks the same
 * facts on the exact ZIP; these run in npm test so a regression shows up
 * before the gate does. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readSave, writeSave, SAVE_V3 } from "../transition.mjs";
import { LEVELS } from "../level.mjs";
import { readSoundSetting, writeSoundSetting, readGentleSetting, writeGentleSetting, readVolumes, writeVolumes } from "../audio.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (name) => readFile(path.join(root, name), "utf8");

test("the release is 1.0.0 with a v1.0 label on the title and a changelog entry", async () => {
  assert.equal(JSON.parse(await read("package.json")).version, "1.0.0");
  const html = await read("index.html");
  // The label sits in the title panel's footer, in the DOM text a player reads.
  const panel = html.slice(html.indexOf('id="title-panel"'), html.indexOf('id="load-error"'));
  assert.match(panel, /<span class="version" id="version">v1\.0<\/span>/);
  assert.match(await read("CHANGELOG.md"), /^## \[1\.0\.0\]/m);
});

test("the credits open from the title and name the team, the music, the font and the synthesised audio", async () => {
  const html = await read("index.html");
  const title = html.slice(html.indexOf('id="title-panel"'), html.indexOf('id="load-error"'));
  assert.match(title, /<button id="credits-open"[^>]*aria-controls="credits-card"[^>]*>Credits<\/button>/, "a Credits button in the title panel");
  const card = html.slice(html.indexOf('id="credits-veil"'), html.indexOf('id="pause-veil"'));
  assert.match(card, /role="dialog" aria-modal="true" aria-labelledby="credits-title"/);
  const text = card.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  for (const s of ["Credits", "Cauê Melo", "Daniel Calônico", "raenkumi", "Lucas Santos", "LSdS", "Rafael Lima", "Kimoh", "Amanda", "meromei", "Bruno Mareto", "Bu Maré", "Solarum Basic", "title and at the far door", "synthesised live in your browser"])
    assert.ok(text.includes(s), `the credits say "${s}"`);
  // game.js wires the opener, the closer and Escape, and keeps the keys away from the game.
  const js = await read("game.js");
  assert.match(js, /\$\("credits-open"\)\.addEventListener\("click", \(\) => showCredits\(true\)\)/);
  assert.match(js, /\$\("credits-back"\)\.addEventListener\("click", \(\) => showCredits\(false\)\)/);
  assert.match(js, /if \(!\$\("credits-veil"\)\.hidden\) \{\s+if \(\["Escape"/);
});

test("itch.json: the viewport is the game surface, click to play and fullscreen are on, and mobile friendliness is decided", async () => {
  const itch = JSON.parse(await read("itch.json"));
  assert.deepEqual([itch.embed.width, itch.embed.height], [960, 640]);
  assert.equal(itch.embed.fullscreenButton, true);
  assert.equal(itch.embed.clickToPlay, true);
  assert.equal(typeof itch.embed.mobileFriendly, "boolean", "a decision, not a placeholder string");
  if (itch.embed.mobileFriendly) assert.ok(["landscape", "portrait", "default"].includes(itch.embed.orientation), "mobile friendly needs an orientation");
});

test("the ZIP carries the README, the changelog and no research, design or audit notes", async () => {
  // The exporter decides by file name only, so run the real package-itch.mjs in a
  // scratch folder that holds an empty file for every name in the repository
  // root (a build in place would race the other tests that build the ZIP).
  const scratch = await mkdtemp(path.join(os.tmpdir(), "solarum-ship-"));
  try {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || ["node_modules", "dist", "assets", "scripts", "tests"].includes(entry.name)) continue;
      if (entry.isFile()) await writeFile(path.join(scratch, entry.name), entry.name === "package-itch.mjs" || entry.name === "itch.json" ? await read(entry.name) : "");
    }
    await mkdir(path.join(scratch, "assets"));
    await writeFile(path.join(scratch, "assets", "solarum.ttf"), "");
    await mkdir(path.join(scratch, "assets", "sfx"));
    await writeFile(path.join(scratch, "assets", "sfx", "Jump.wav"), "");
    execFileSync(process.execPath, ["package-itch.mjs"], { cwd: scratch, stdio: "ignore" });
    const names = JSON.parse(await readFile(path.join(scratch, "dist", "build-report.json"), "utf8")).entries.map((e) => e.name);
    const docs = names.filter((n) => /\.(md|txt)$/i.test(n)).sort();
    assert.deepEqual(docs, ["CHANGELOG.md", "README.md"], "player docs only (a licence file would join them)");
    assert.ok(names.includes("index.html") && names.includes("game.js") && names.includes("assets/solarum.ttf"));
    assert.ok(!names.includes("assets/sfx/Jump.wav"), "the archived WAVs stay home");
    assert.ok(!names.some((n) => /RESEARCH|AUDIT|LEVEL_DESIGN|ITCH_IO|soundboard|\.mjs$|^tests\/|^scripts\//.test(n)), `nothing a player never needs: ${names.join(", ")}`);
    // A licence file at the root would ship (none exists yet).
    await writeFile(path.join(scratch, "LICENSE.txt"), "");
    execFileSync(process.execPath, ["package-itch.mjs"], { cwd: scratch, stdio: "ignore" });
    assert.ok(JSON.parse(await readFile(path.join(scratch, "dist", "build-report.json"), "utf8")).entries.some((e) => e.name === "LICENSE.txt"));
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

/* ---------- the save: guarded, versioned, migrated ---------- */
const KEYS = LEVELS.map((d) => d.key);

test("a version-1 save keeps its open numeral and starts the rest fresh", () => {
  const v1 = readSave({ unlocked: 5, great: { 1: 3, 2: 2 }, done: { 1: true } });
  assert.deepEqual(v1, { unlocked: 5, great: {}, done: {}, stars: {}, falls: 0, credits: false, relics: [] });
});

test("a version-2 save that names retired interim levels migrates: known levels carry over, retired names are dropped", () => {
  // Revision six's interim levels and the Great Stars saved under keys the
  // campaign no longer has ("wind", "constellation"): ignored, never fatal.
  const v2 = { v: 2, unlocked: 4, great: { [KEYS[0]]: 3, [KEYS[1]]: 1, wind: 2, constellation: 3, "far-door": 1 }, done: { [KEYS[0]]: true, wind: true, constellation: true } };
  const p = readSave(JSON.parse(JSON.stringify(v2)));
  assert.equal(p.unlocked, 4);
  assert.deepEqual(p.great, { 1: 3, 2: 1 }, "Great Stars of the levels that still exist");
  assert.deepEqual(p.done, { 1: true });
  assert.deepEqual([p.stars, p.falls, p.credits, p.relics], [{}, 0, false, []], "journey totals start fresh");
  // Written back it is a version-3 save with the same progress, and reads the same again.
  const out = writeSave(p);
  assert.equal(out.v, SAVE_V3);
  assert.deepEqual(readSave(JSON.parse(JSON.stringify(out))), p);
  assert.ok(!JSON.stringify(out).includes("constellation"));
});

test("a version-3 save is sanitised field by field: bad numbers, wrong types and unknown fields never get through", () => {
  // (NaN and Infinity become null in JSON, so those entries are dropped before the sanitiser.)
  const raw = { v: 3, unlocked: 99, great: { [KEYS[0]]: 7.9, [KEYS[1]]: -2, [KEYS[2]]: "x", [KEYS[3]]: NaN }, done: { [KEYS[0]]: 1, [KEYS[1]]: 0 }, stars: { [KEYS[0]]: Infinity, [KEYS[1]]: 12 }, falls: -3, credits: "yes", relics: ["double", 7, null, "cape"], extra: { a: 1 } };
  const p = readSave(JSON.parse(JSON.stringify(raw)));
  assert.equal(p.unlocked, LEVELS.length, "never past the last level");
  assert.deepEqual(p.great, { 1: 7, 2: 0, 3: 0 }, "whole, non-negative counts; a null is dropped");
  assert.deepEqual(p.done, { 1: true, 2: false });
  assert.deepEqual(p.stars, { 2: 12 });
  assert.equal(p.falls, 0);
  assert.equal(p.credits, true);
  assert.deepEqual(p.relics, ["double", "cape"]);
  assert.ok(!("extra" in p));
});

test("any value in the save slot reads without throwing, and the result is always a complete save", () => {
  const hostile = [undefined, null, 0, 1, -1, NaN, "", "x", "{}", true, [], [1, 2, 3], {}, { v: 3 }, { v: 3, unlocked: "2" }, { v: 3, unlocked: 2.5 }, { v: 2 }, { v: 99, unlocked: 3 }, { unlocked: 3, great: [] }, { v: 3, unlocked: 2, great: [1, 2], done: "x", stars: 5, relics: "double" }, JSON.parse('{"__proto__":{"polluted":1},"v":3,"unlocked":2}'), { v: 3, unlocked: 2, great: { constructor: 3, toString: 1 } }];
  for (const raw of hostile) {
    const p = readSave(raw);
    assert.ok(Number.isInteger(p.unlocked) && p.unlocked >= 1 && p.unlocked <= LEVELS.length, JSON.stringify(raw));
    for (const f of ["great", "done", "stars"]) assert.equal(typeof p[f], "object");
    assert.ok(Number.isInteger(p.falls) && p.falls >= 0);
    assert.equal(typeof p.credits, "boolean");
    assert.ok(Array.isArray(p.relics));
    assert.doesNotThrow(() => JSON.stringify(writeSave(p)));
  }
  assert.equal({}.polluted, undefined, "no prototype pollution");
});

test("settings read from storage that throws, is missing or holds junk: defaults, and writes report failure instead of throwing", () => {
  // A sandboxed iframe or a privacy mode makes `window.localStorage` itself throw.
  const blocked = () => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  };
  assert.equal(readSoundSetting(blocked), true, "sound defaults on");
  assert.equal(readGentleSetting(blocked), false);
  assert.deepEqual(readVolumes(blocked), { music: 1, sounds: 1 });
  assert.equal(writeSoundSetting(blocked, false), false);
  assert.equal(writeGentleSetting(blocked, true), false);
  assert.equal(writeVolumes(blocked, { music: 0.5, sounds: 0.5 }), false);
  assert.deepEqual(readVolumes({ getItem: () => "not json" }), { music: 1, sounds: 1 });
  assert.deepEqual(readVolumes({ getItem: () => JSON.stringify({ music: "loud", sounds: 7 }) }), { music: 1, sounds: 1 });
  assert.deepEqual(readVolumes({ getItem: () => JSON.stringify({ music: 0.25, sounds: -3 }) }), { music: 0.25, sounds: 0 });
  assert.equal(readSoundSetting(null), true);
});
