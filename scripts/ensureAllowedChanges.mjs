import { spawnSync } from "node:child_process";

const allowed = process.argv.slice(2);

function isAllowed(path) {
  return allowed.some((entry) =>
    entry.endsWith("/") ? path.startsWith(entry) : path === entry
  );
}

function changedPaths() {
  const result = spawnSync("git", ["status", "--porcelain=v1"], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  return result.stdout
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => {
      const path = line.slice(3).trim();
      const renameMarker = " -> ";
      return path.includes(renameMarker) ? path.slice(path.indexOf(renameMarker) + renameMarker.length) : path;
    });
}

const disallowed = changedPaths().filter((path) => !isAllowed(path));

if (disallowed.length > 0) {
  console.error("Unexpected repository changes:");
  for (const path of disallowed) {
    console.error(`- ${path}`);
  }
  console.error("");
  console.error(
    allowed.length > 0
      ? `Allowed changes: ${allowed.join(", ")}`
      : "No repository changes are allowed at this point."
  );
  process.exit(1);
}

console.log(
  allowed.length > 0
    ? `Only allowed paths changed: ${allowed.join(", ")}`
    : "Repository is clean."
);
