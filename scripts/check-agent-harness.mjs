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
  assert(agents.includes("docs/status.md"), "AGENTS.md must point broad work at docs/status.md.");
  assert(agents.includes("docs/roadmap.md"), "AGENTS.md must point broad work at docs/roadmap.md.");
  assert(agents.includes("docs/completed-milestones.md"), "AGENTS.md must point completed work history at docs/completed-milestones.md.");
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
  assert(packageJson.scripts["check:runtime-smoke"]?.includes("src/test/runtime-harness.test.tsx"), "package.json must define a focused runtime smoke command.");
  assert(packageJson.scripts["check:agent-gc"] === "node scripts/check-agent-gc.mjs", "package.json must define check:agent-gc.");
  assert(packageJson.scripts.check.includes("pnpm check:harness"), "pnpm check must run check:harness.");
  assert(packageJson.scripts.check.includes("pnpm check:agent-gc"), "pnpm check must run check:agent-gc.");
});

check("large-log fast regression and slow benchmark stay separated", () => {
  const packageJson = JSON.parse(readText("package.json"));
  const completedMilestones = readText("docs/completed-milestones.md");
  const benchmark = readText("src/lib/logs/large-session.benchmark.test.ts");

  assert(packageJson.scripts["test:large-regression"]?.includes("parser.test.ts"), "package.json must keep a fast large regression script.");
  assert(packageJson.scripts["bench:large-session"]?.includes("LOG_LENS_LARGE_BENCH=1"), "large benchmark must be opt-in through LOG_LENS_LARGE_BENCH.");
  assert(benchmark.includes("LARGE_SESSION_BENCH_LINE_COUNT = 200_000"), "large benchmark candidate must preserve the 200k-line target.");
  assert(benchmark.includes("describe.skip"), "large benchmark candidate must stay out of the default pnpm test path.");
  assert(
    completedMilestones.includes("빠른 regression") && completedMilestones.includes("느린 benchmark"),
    "completed milestones must document the fast/slow fixture split.",
  );
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
  assert(appSmoke.includes("selected-file search, level, source, and field facet filters"), "App smoke tests must cover selected-file filter combinations.");
});

check("parser tests cover large-log analysis behavior", () => {
  const parserTest = readText("src/lib/logs/parser.test.ts");

  assert(parserTest.includes("generateMixedLargeJsonLines"), "Parser tests must include a mixed large-log fixture.");
  assert(parserTest.includes("keeps large parsed sessions analyzable"), "Parser tests must exercise large parsed session analysis.");
  assert(parserTest.includes("buildHourlyChartData"), "Large-log tests must verify analysis chart counts.");
  assert(parserTest.includes("3000"), "Large-log fixture should stay large enough to catch scaling regressions.");
});

check("runtime smoke covers selected-file and large UI contracts", () => {
  const runtimeSmoke = readText("src/test/runtime-harness.test.tsx");
  const tauri = readText("src-tauri/src/lib.rs");

  assert(runtimeSmoke.includes("renders a large selected file through the Tauri line stream without DOM blow-up"), "Runtime smoke must cover large selected-file rendering.");
  assert(runtimeSmoke.includes("falls back to whole-file reading after a line-stream failure"), "Runtime smoke must cover whole-file fallback after line streaming fails.");
  assert(runtimeSmoke.includes("surfaces scoped file access failures before any file read"), "Runtime smoke must cover scoped file access failures.");
  assert(runtimeSmoke.includes("toBeLessThanOrEqual(24)"), "Runtime smoke must keep virtualized row count bounded for large sessions.");
  assert(tauri.includes("allow_file_access_rejects_empty_paths"), "Rust file access tests must reject empty paths.");
});

check("status, roadmap, and milestone docs keep the autonomous backlog aligned", () => {
  const agents = readText("AGENTS.md");
  const logFormatSupport = readText("docs/log-format-support.md");
  const status = readText("docs/status.md");
  const nextPhase = readText("docs/next-phase-spec.md");
  const roadmap = readText("docs/roadmap.md");
  const completedMilestones = readText("docs/completed-milestones.md");

  assert(agents.includes("docs/status.md"), "AGENTS.md must route broad work to docs/status.md.");
  assert(agents.includes("docs/roadmap.md"), "AGENTS.md must route broad work to docs/roadmap.md.");
  assert(status.includes("Custom Alias Override UI"), "docs/status.md must retain completed autonomous implementation history.");
  assert(status.includes("docs/completed-milestones.md"), "docs/status.md must link completed milestone history.");
  assert(roadmap.includes("docs/completed-milestones.md"), "docs/roadmap.md must link completed milestone history.");
  assert(nextPhase.includes("docs/completed-milestones.md"), "docs/next-phase-spec.md must link completed milestone history.");
  assert(completedMilestones.includes("docs/log-format-support.md"), "completed milestones must track timestamp support documentation.");
  assert(
    completedMilestones.includes("timestamp_missing") && completedMilestones.includes("timestamp_parse_failed"),
    "completed milestones must preserve the timestamp diagnostic split.",
  );
  assert(logFormatSupport.includes("timestamp_missing") && logFormatSupport.includes("timestamp_parse_failed"), "timestamp support docs must describe diagnostic split.");
  assert(nextPhase.includes("## 구현 순서"), "docs/next-phase-spec.md must preserve ordered implementation guidance.");
  assert(nextPhase.includes("1. custom alias override UI"), "docs/next-phase-spec.md must keep custom alias override first.");
  assert(nextPhase.includes("수용 기준"), "docs/next-phase-spec.md must provide acceptance criteria for autonomous implementation.");
});

check("agent autonomy playbook covers the full feedback loop", () => {
  const agents = readText("AGENTS.md");
  const contract = readText("docs/agent-operating-contract.md");
  const skill = readText(".agents/skills/loglens/SKILL.md");
  const playbook = readText("docs/agent-autonomy-playbook.md");

  assert(agents.includes("docs/agent-autonomy-playbook.md"), "AGENTS.md must route full lifecycle work to docs/agent-autonomy-playbook.md.");
  assert(contract.includes("docs/agent-autonomy-playbook.md"), "agent operating contract must link to the autonomy playbook.");
  assert(skill.includes("docs/agent-autonomy-playbook.md"), "repo-local skill must include the autonomy playbook in the first-read map.");
  assert(playbook.includes("## End-to-end 루프"), "autonomy playbook must define the end-to-end loop.");
  assert(playbook.includes("## 데스크톱 검증"), "autonomy playbook must define desktop validation handling.");
  assert(playbook.includes("## PR/CI 피드백 루프"), "autonomy playbook must define PR/CI feedback handling.");
  assert(playbook.includes("## 품질 GC"), "autonomy playbook must define recurring quality garbage collection.");
  assert(playbook.includes("## 에스컬레이션 패킷"), "autonomy playbook must define escalation packets.");
});

check("repository docs reflect the current streaming and windowing behavior", () => {
  const repositoryOverview = readText("docs/repository-overview.md");
  const status = readText("docs/status.md");
  const readme = readText("README.md");

  assert(repositoryOverview.includes("docs/log-format-support.md"), "docs/repository-overview.md must link log format support docs.");
  assert(repositoryOverview.includes("라인 스트리밍"), "docs/repository-overview.md must describe line streaming file loading.");
  assert(repositoryOverview.includes("windowed"), "docs/repository-overview.md must describe windowed event rendering.");
  assert(status.includes("라인 스트리밍"), "docs/status.md must describe line streaming file loading.");
  assert(status.includes("issue-only"), "docs/status.md must describe issue filter smoke coverage.");
  assert(status.includes("대용량 분석 fixture"), "docs/status.md must describe large analysis fixture coverage.");
  assert(readme.includes("docs/log-format-support.md"), "README.md must link log format support docs.");
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
