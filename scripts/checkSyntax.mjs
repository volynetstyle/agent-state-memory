import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOTS = [".github", "scripts", "src", "test"];

async function* files(root) {
  let entries;

  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  for (const entry of entries) {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      yield* files(path);
    } else if (entry.isFile() && path.endsWith(".mjs")) {
      yield path;
    }
  }
}

const checked = [];

for (const root of ROOTS) {
  for await (const path of files(root)) {
    const result = spawnSync(process.execPath, ["--check", path], {
      encoding: "utf8"
    });

    if (result.status !== 0) {
      process.stderr.write(result.stdout);
      process.stderr.write(result.stderr);
      process.exit(result.status ?? 1);
    }

    checked.push(path);
  }
}

console.log(`Syntax check passed for ${checked.length} .mjs files.`);
