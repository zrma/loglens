# LogLens Agent Guide

이 파일은 이 저장소에서 작업하는 에이전트를 위한 짧은 지도입니다. 상세 맥락은 이 파일에 계속 추가하지 말고 `docs/` 또는 `.agents/skills/loglens/SKILL.md`에 둡니다.

## 운영 계약

- 기본값은 자율 실행입니다. 명시적 판단, 누락된 credential, 파괴적 작업, 저장소 맥락으로 추론할 수 없는 scope 선택이 필요한 경우에만 사용자에게 묻습니다.
- 공통 하네스 인터페이스와 LogLens overlay는 `docs/agent-harness.md`를 따릅니다.
- 에스컬레이션, 검증, 복구, publish 동작의 기준은 `docs/agent-operating-contract.md`를 따릅니다.
- PR/CI 피드백 루프, 데스크톱 검증, 품질 GC 절차는 `docs/agent-autonomy-playbook.md`를 따릅니다.
- 사용자가 commit/push를 명시적으로 요청한 경우에는 새 위험이 드러나지 않는 한 다시 묻지 말고 검증, `jj describe`, bookmark 업데이트, `jj git push`까지 진행합니다.

<!-- agent-harness-baseline:start -->
## Agent Harness Baseline (GPT-5.6)

Baseline ID: `openai-gpt-5.6-2026-07-10`.

- Source of truth: use the `openai-docs` skill and the official [latest model guide](https://developers.openai.com/api/docs/guides/latest-model) plus [prompting best practices](https://developers.openai.com/api/docs/guides/latest-model#prompting-best-practices) before changing OpenAI model, API, prompt, or agent guidance.
- Model target: when the task asks for the current or latest OpenAI baseline, use `gpt-5.6`. This is harness guidance, not proof that the application calls OpenAI; change runtime model strings only at an existing OpenAI integration point.
- Prompt budget: start with the smallest prompt and task-relevant tool set that reliably completes the work. Preserve project-specific constraints, remove redundant generic instructions, and add examples only for an observed failure.
- Request modes: for answer, explain, review, diagnose, or plan requests, inspect and report without implementation. For change, build, or fix requests, make the requested in-scope local changes and run relevant non-destructive validation.
- Permissions: reading, searching, editing in-scope files, and running non-destructive checks are pre-authorized for change tasks. Require confirmation for external writes not explicitly requested, destructive or irreversible actions, purchases or cost, secrets, or material scope expansion.
- Persistence: continue until the requested outcome is complete; do not stop after only analysis, a partial patch, or an intermediate tool success. Stop and escalate only at a real permission, product-decision, or external-state boundary.
- Verification: treat tool and patch success as provisional. Re-read the diff and verify the user-visible or runtime outcome with the narrowest meaningful checks, then broaden only when risk warrants it.
- Output: lead with the conclusion. Include required evidence, material caveats, and the next action; trim introductions, repetition, generic reassurance, and optional background before trimming required content.
- Structure: use a lightweight task-specific plan or output shape. Do not impose a global template or long process narration when the repository already supplies the necessary workflow.
- Modes and orchestration: configure Pro mode in the API or runtime rather than asking the model to “think harder.” Use Programmatic Tool Calling only for bounded reduction stages with explicit schemas, limits, and no approval-sensitive side effects; keep semantic decisions and final validation direct.
- Evaluation: add or retain harness instructions only when repository checks or representative tasks show they improve final-answer completeness, evidence quality, reliability, latency, or cost. Evaluate the final result, not just tool-call count.
- Project overlay: the remaining sections of this file and the linked project docs define domain-specific architecture, tests, safety boundaries, escalation rules, and publish gates. They may specialize this baseline but must not silently weaken its permission or evidence requirements.
<!-- agent-harness-baseline:end -->

## 저장소 지도

- `README.md`: 제품 의도, 현재 기능 목록, 실행 방법, VCS 기본 흐름
- `docs/agent-harness.md`: 이 저장소의 canonical 하네스 구조와 LogLens project overlay
- `docs/agent-autonomy-playbook.md`: end-to-end 실행, PR/CI 피드백, 품질 GC 절차
- `docs/status.md`: 현재 구현 상태, 리스크, 다음 우선순위
- `docs/roadmap.md`: 더 넓은 제품 방향과 다음 작업 후보
- `docs/next-phase-spec.md`: 완료된 MVP 구현 배치의 스펙과 수용 기준
- `docs/completed-milestones.md`: 닫힌 작업 단위의 완료 이력
- `docs/repository-overview.md`: 런타임 구조와 주요 파일
- `.agents/skills/loglens/SKILL.md`: repo-local 에이전트 워크플로

## 개발 루프

1. `jj status`로 시작하고 관련 문서/코드를 확인합니다.
2. 사용자가 더 좁은 목표를 주지 않았다면 `docs/status.md`와 `docs/roadmap.md`에서 다음 후보를 고릅니다.
3. 요청 결과에 필요한 제품 동작, 문서, 테스트, tooling 변경으로 범위를 좁힙니다.
4. 동작, 명령, workflow, 수용된 제약이 바뀌면 같은 변경에서 문서를 갱신합니다.
5. 반복 중에는 가장 좁은 유효 검증을 돌리고, commit/push 전에는 `pnpm check`를 돌립니다.

## 코드 경계

- Frontend UI는 `src/App.tsx`와 `src/features/log-explorer/`에 둡니다.
- Log parsing과 analysis 로직은 `src/lib/logs/`에 둡니다.
- Tauri/Rust는 작업이 native 동작을 요구하지 않는 한 얇은 desktop shell로 유지합니다.
- 파일 접근은 Tauri capability와 `allow_file_access` 경로를 통해 사용자가 선택한 파일로 제한합니다.

## 명령

```bash
pnpm install
pnpm tauri dev
pnpm check
```

집중 검증:

```bash
pnpm check:harness
pnpm lint:js
pnpm lint:rust
pnpm test
pnpm build
pnpm test:rust
```

## VCS

- 로컬 VCS 작업은 `jj status`, `jj diff`, `jj log`를 사용합니다.
- commit/change 메시지는 scope 없이 `<type>: <summary>` 형식을 사용합니다.
- 메시지를 작성할 때는 아래 trailer를 정확히 한 번 포함합니다.

```text
Co-authored-by: Codex (AI-generated) <codex@1day1coding.com>
```
