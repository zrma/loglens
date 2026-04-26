import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);

function readText(path) {
  return readFileSync(new URL(path, root), "utf8");
}

const checks = [];

function check(name, fn) {
  checks.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

check("AGENTS.md remains a short routing map", () => {
  const agents = readText("AGENTS.md");
  const nonBlankLineCount = agents.split("\n").filter((line) => line.trim()).length;

  assert(nonBlankLineCount <= 90, "AGENTS.md should stay concise; move detailed rules into docs/ or .agents/skills.");
  assert(agents.includes("docs/agent-operating-contract.md"), "AGENTS.md must route escalation rules to docs/agent-operating-contract.md.");
  assert(agents.includes("docs/next-phase-spec.md"), "AGENTS.md must point broad work at docs/next-phase-spec.md.");
});

check("agent operating contract defines autonomous escalation gates", () => {
  const contract = readText("docs/agent-operating-contract.md");

  assert(contract.includes("## 에스컬레이션 조건"), "agent operating contract must define explicit escalation conditions.");
  assert(contract.includes("pnpm check"), "agent operating contract must name the publish verification gate.");
  assert(contract.includes("harness"), "agent operating contract must preserve the harness-engineering framing.");
});

check("publish gate includes harness validation", () => {
  const packageJson = JSON.parse(readText("package.json"));

  assert(packageJson.scripts["check:harness"] === "node scripts/check-agent-harness.mjs", "package.json must define check:harness.");
  assert(packageJson.scripts.check.includes("pnpm check:harness"), "pnpm check must run check:harness.");
});

check("file access stays scoped through the Tauri command", () => {
  const hook = readText("src/features/log-explorer/hooks/useLogSession.ts");
  const tauri = readText("src-tauri/src/lib.rs");

  assert(hook.includes("invoke(\"allow_file_access\""), "frontend file loading must invoke allow_file_access before reading selected files.");
  assert(tauri.includes("canonicalize()"), "allow_file_access must canonicalize selected paths before allowing access.");
  assert(tauri.includes("is_file()"), "allow_file_access must reject non-file paths.");
});

check("repository docs reflect the current streaming and windowing behavior", () => {
  const repositoryOverview = readText("docs/repository-overview.md");
  const status = readText("docs/status.md");
  const readme = readText("README.md");

  assert(repositoryOverview.includes("라인 스트리밍"), "docs/repository-overview.md must describe line streaming file loading.");
  assert(repositoryOverview.includes("windowed"), "docs/repository-overview.md must describe windowed event rendering.");
  assert(status.includes("라인 스트리밍"), "docs/status.md must describe line streaming file loading.");
  assert(readme.includes("windowed"), "README.md must describe windowed event rendering.");
});

const failures = [];

for (const { name, fn } of checks) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.error(`not ok - ${name}`);
    console.error(error instanceof Error ? error.message : String(error));
  }
}

if (failures.length > 0) {
  process.exitCode = 1;
}
