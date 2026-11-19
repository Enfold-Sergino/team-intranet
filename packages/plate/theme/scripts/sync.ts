// `pnpm plate:sync`: refresh delta/ from Plate with the Delta CLI, check it, then show what changed.
// Needs the CLI (`pnpm add -g @lars-plate/delta-cli`) and PLATE_THEME_PRN in the root .env. Runs with
// Node's type stripping, so it only imports theme.ts (no workspace packages).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { diffTheme, prepareTheme, readTheme } from "../src/theme.ts";

const DELTA = "delta";
const SCRATCH = ".delta";
const FETCHED = join(SCRATCH, "fetched");

if (existsSync("../../../.env")) process.loadEnvFile("../../../.env");
function fail(message: string): never {
  console.error(`\n${message}`);
  process.exit(1);
}
if (!process.env.PLATE_THEME_PRN)
  fail("Set PLATE_THEME_PRN in .env: the full PRN of the theme in Plate.");
const profile = process.env.PLATE_DELTA_PROFILE?.trim() || undefined;

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  // The CLI always writes a Vue component per block; this project doesn't use them.
  if (command === "delta") rmSync(join(SCRATCH, "components"), { recursive: true, force: true });
  if ((result.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT")
    fail(`\`${command}\` not found: install it with \`pnpm add -g @lars-plate/delta-cli\`.`);
  if (result.status !== 0) fail(`\`${[command, ...args].join(" ")}\` failed.`);
}

// 1. A CLI profile holds the Plate API token (oclif's config folder; on Windows the CLI checks).
if (process.platform !== "win32") {
  const config =
    process.env.DELTA_CONFIG_DIR ??
    join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "delta");
  const profiles = () =>
    existsSync(join(config, "profiles"))
      ? readdirSync(join(config, "profiles")).filter((f) => f.endsWith(".json"))
      : [];
  if (!profiles().length) {
    console.log("No Delta CLI profile yet. Creating one: it asks for a Plate API token.\n");
    run("delta", ["profile", "add"]);
  }
  if (!profile && !existsSync(join(config, "default.json")))
    run("delta", ["profile", "set-default"]);
}

// 2. Sync into a scratch folder (the CLI fails when its folders don't exist).
rmSync(FETCHED, { recursive: true, force: true });
for (const dir of ["building-blocks", "content-types", "../components"])
  mkdirSync(join(FETCHED, dir), { recursive: true });
run("delta", ["theme", "sync", ...(profile ? ["--profile", profile] : [])]);

// 3. Only a complete theme replaces delta/.
const fetched = readTheme(FETCHED);
const theme = prepareTheme({ blocks: fetched.blocks, contentTypes: fetched.contentTypes });
if ("errors" in theme)
  fail(
    `The synced theme is incomplete, so delta/ was left as it is:\n${theme.errors.map((e) => `- ${e}`).join("\n")}\nThe CLI output is in ${FETCHED}/.`,
  );
const before = readTheme(DELTA);
for (const [dir, entries] of [
  ["building-blocks", theme.blocks],
  ["content-types", theme.contentTypes],
] as const) {
  rmSync(join(DELTA, dir), { recursive: true, force: true });
  mkdirSync(join(DELTA, dir), { recursive: true });
  for (const entry of entries)
    writeFileSync(join(DELTA, dir, `${entry.slug}.json`), `${JSON.stringify(entry, null, 2)}\n`);
}
rmSync(SCRATCH, { recursive: true, force: true });

// 4. What changed. `pnpm test` then checks the theme against the core contract.
const diff = diffTheme(before, theme);
console.log(
  `\nSynced ${theme.blocks.length} building blocks and ${theme.contentTypes.length} content types into delta/.`,
);
for (const [kind, label] of [
  ["blocks", "Building blocks"],
  ["contentTypes", "Content types"],
] as const) {
  const { added, removed, changed } = diff[kind];
  const parts = [
    added.length && `added ${added.join(", ")}`,
    removed.length && `removed ${removed.join(", ")}`,
    changed.length && `changed ${changed.join(", ")}`,
  ].filter(Boolean);
  console.log(`${label}: ${parts.length ? parts.join("; ") : "no changes"}`);
}
console.log("\nRun `pnpm test` to check the theme against the core contract.");
