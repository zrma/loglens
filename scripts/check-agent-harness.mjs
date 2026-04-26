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
  assert(contract.includes("## 자체 리뷰 루프"), "agent operating contract must define the local self-review loop.");
  assert(contract.includes("pnpm check"), "agent operating contract must name the publish verification gate.");
  assert(contract.includes("harness"), "agent operating contract must preserve the harness-engineering framing.");
});

check("publish gate includes harness validation", () => {
  const packageJson = JSON.parse(readText("package.json"));

  assert(packageJson.scripts["check:harness"] === "node scripts/check-agent-harness.mjs", "package.json must define check:harness.");
  assert(packageJson.scripts.check.includes("pnpm check:harness"), "pnpm check must run check:harness.");
});

check("CI and pre-push use the same publish gate", () => {
  const workflow = readText(".github/workflows/ci.yml");
  const lefthook = readText("lefthook.yml");

  assert(workflow.includes("run: pnpm check"), "GitHub Actions CI must run pnpm check.");
  assert(lefthook.includes("pre-push:") && lefthook.includes("run: pnpm check"), "lefthook pre-push must run pnpm check.");
});

check("file access stays scoped through the Tauri command", () => {
  const hook = readText("src/features/log-explorer/hooks/useLogSession.ts");
  const tauri = readText("src-tauri/src/lib.rs");

  assert(hook.includes("invoke(\"allow_file_access\""), "frontend file loading must invoke allow_file_access before reading selected files.");
  assert(tauri.includes("canonicalize()"), "allow_file_access must canonicalize selected paths before allowing access.");
  assert(tauri.includes("is_file()"), "allow_file_access must reject non-file paths.");
});

check("UI smoke tests cover agent-legible runtime workflows", () => {
  const appSmoke = readText("src/test/app.smoke.test.tsx");

  assert(appSmoke.includes("issue filtering and analysis tab navigation"), "App smoke tests must cover issue filtering and analysis tab navigation.");
  assert(appSmoke.includes("필터 결과 2개 이벤트"), "App smoke tests must assert filtered event counts.");
  assert(appSmoke.includes("연관 분석"), "App smoke tests must cover analysis tab navigation.");
  assert(appSmoke.includes("allow_file_access"), "App smoke tests must cover scoped Tauri file access.");
});

check("parser tests cover large-log analysis behavior", () => {
  const parserTest = readText("src/lib/logs/parser.test.ts");

  assert(parserTest.includes("generateMixedLargeJsonLines"), "Parser tests must include a mixed large-log fixture.");
  assert(parserTest.includes("keeps large parsed sessions analyzable"), "Parser tests must exercise large parsed session analysis.");
  assert(parserTest.includes("buildHourlyChartData"), "Large-log tests must verify analysis chart counts.");
  assert(parserTest.includes("3000"), "Large-log fixture should stay large enough to catch scaling regressions.");
});

check("status and next phase docs keep the autonomous backlog aligned", () => {
  const agents = readText("AGENTS.md");
  const status = readText("docs/status.md");
  const nextPhase = readText("docs/next-phase-spec.md");

  assert(agents.includes("docs/next-phase-spec.md"), "AGENTS.md must route broad work to docs/next-phase-spec.md.");
  assert(status.includes("Custom Alias Override UI"), "docs/status.md must name the next autonomous implementation target.");
  assert(nextPhase.includes("## 구현 순서"), "docs/next-phase-spec.md must preserve ordered implementation guidance.");
  assert(nextPhase.includes("1. custom alias override UI"), "docs/next-phase-spec.md must keep custom alias override first.");
  assert(nextPhase.includes("수용 기준"), "docs/next-phase-spec.md must provide acceptance criteria for autonomous implementation.");
});

check("repository docs reflect the current streaming and windowing behavior", () => {
  const repositoryOverview = readText("docs/repository-overview.md");
  const status = readText("docs/status.md");
  const readme = readText("README.md");

  assert(repositoryOverview.includes("라인 스트리밍"), "docs/repository-overview.md must describe line streaming file loading.");
  assert(repositoryOverview.includes("windowed"), "docs/repository-overview.md must describe windowed event rendering.");
  assert(status.includes("라인 스트리밍"), "docs/status.md must describe line streaming file loading.");
  assert(status.includes("issue-only"), "docs/status.md must describe issue filter smoke coverage.");
  assert(status.includes("대용량 분석 fixture"), "docs/status.md must describe large analysis fixture coverage.");
  assert(readme.includes("windowed"), "README.md must describe windowed event rendering.");
  assert(readme.includes("agent-legible"), "README.md must describe agent-legible smoke coverage.");
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
