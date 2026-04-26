import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../", import.meta.url);
const rootPath = root.pathname;

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

function walk(dir, result = []) {
  for (const entry of readdirSync(dir)) {
    if (
      entry === ".git" ||
      entry === ".jj" ||
      entry === "node_modules" ||
      entry === "dist" ||
      entry === "target"
    ) {
      continue;
    }

    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      walk(path, result);
    } else {
      result.push(path);
    }
  }
  return result;
}

function projectFiles() {
  return walk(rootPath)
    .map((path) => relative(rootPath, path))
    .filter((path) => {
      return (
        path.endsWith(".md") ||
        path.endsWith(".mjs") ||
        path.endsWith(".ts") ||
        path.endsWith(".tsx") ||
        path.endsWith(".rs") ||
        path.endsWith(".json") ||
        path.endsWith(".yml") ||
        path.endsWith(".yaml")
      );
    });
}

check("agent autonomy playbook keeps the full lifecycle visible", () => {
  const playbook = readText("docs/agent-autonomy-playbook.md");

  assert(playbook.includes("## End-to-end 루프"), "playbook must describe the implementation-to-publish loop.");
  assert(playbook.includes("## 데스크톱 검증"), "playbook must describe desktop/runtime validation.");
  assert(playbook.includes("## PR/CI 피드백 루프"), "playbook must describe PR, CI, and review feedback handling.");
  assert(playbook.includes("## 품질 GC"), "playbook must describe recurring quality garbage collection.");
  assert(playbook.includes("## 에스컬레이션 패킷"), "playbook must define what to include when escalation is required.");
});

check("agent GC is part of the publish gate", () => {
  const packageJson = JSON.parse(readText("package.json"));
  const checkScript = packageJson.scripts.check ?? "";

  assert(packageJson.scripts["check:agent-gc"] === "node scripts/check-agent-gc.mjs", "package.json must define check:agent-gc.");
  assert(checkScript.includes("pnpm check:agent-gc"), "pnpm check must run check:agent-gc.");
});

check("autonomy docs are discoverable from the routing map", () => {
  const agents = readText("AGENTS.md");
  const readme = readText("README.md");
  const contributing = readText("CONTRIBUTING.md");

  assert(agents.includes("docs/agent-autonomy-playbook.md"), "AGENTS.md must route agents to the autonomy playbook.");
  assert(readme.includes("docs/agent-autonomy-playbook.md"), "README.md must link the autonomy playbook.");
  assert(contributing.includes("docs/agent-autonomy-playbook.md"), "CONTRIBUTING.md must link the autonomy playbook.");
});

check("status and roadmap keep quality drift explicit", () => {
  const status = readText("docs/status.md");
  const roadmap = readText("docs/roadmap.md");

  assert(status.includes("자율 실행 하네스"), "docs/status.md must summarize the autonomous harness state.");
  assert(status.includes("실제 Tauri 데스크톱 창 자동화"), "docs/status.md must keep the desktop automation limitation visible.");
  assert(roadmap.includes("품질 GC"), "docs/roadmap.md must keep recurring quality GC on the roadmap.");
});

check("repo text does not accumulate unresolved debt markers", () => {
  const markerPattern = /\b(TODO|FIXME|TBD|XXX|HACK)\b/;
  const offenders = [];

  for (const path of projectFiles()) {
    if (path === "scripts/check-agent-gc.mjs") {
      continue;
    }

    const text = readText(path);
    if (markerPattern.test(text)) {
      offenders.push(path);
    }
  }

  assert(offenders.length === 0, `remove unresolved debt markers or move them into docs/roadmap.md: ${offenders.join(", ")}`);
});

check("tsx buttons declare explicit types", () => {
  const buttonTagPattern = /<button\b[\s\S]*?>/g;
  const offenders = [];

  for (const path of projectFiles()) {
    if (!path.endsWith(".tsx")) {
      continue;
    }

    const text = readText(path);

    for (const match of text.matchAll(buttonTagPattern)) {
      if (/\btype=/.test(match[0])) {
        continue;
      }

      const lineNumber = text.slice(0, match.index).split("\n").length;
      offenders.push(`${path}:${lineNumber}`);
    }
  }

  assert(offenders.length === 0, `add type="button" to raw button elements: ${offenders.join(", ")}`);
});

check("repo guidance does not leak machine-specific home paths", () => {
  const pathPattern = /\/Users\/[A-Za-z0-9._-]+|\/home\/[A-Za-z0-9._-]+/;
  const offenders = [];

  for (const path of projectFiles()) {
    if (!path.endsWith(".md") && !path.endsWith(".yaml") && !path.endsWith(".yml")) {
      continue;
    }

    const text = readText(path);
    if (pathPattern.test(text)) {
      offenders.push(path);
    }
  }

  assert(offenders.length === 0, `replace machine-specific home paths with repo-relative paths: ${offenders.join(", ")}`);
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
