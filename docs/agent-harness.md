# Agent Harness

## Interface

- Structure ID: `agent-harness-v1`.
- Baseline ID: `openai-gpt-5.6-2026-07-10`.
- Convergence stage: `canonical`.
- Target stage: `canonical`.
- Canonical check: `scripts/check-agent-harness-interface.sh`.

`AGENTS.md`가 공통 GPT-5.6 계약을 소유하고, 이 문서는 LogLens desktop/product overlay와 기존 operating contract로 가는 canonical 진입점이다.

## Project Objective

대용량 로그를 안전하게 열고 parsing, filtering, issue/trace analysis를 수행하는 agent-legible Tauri desktop application을 발전시킨다.

## Source Of Truth

- 현재 구현/리스크: `docs/status.md`; 다음 우선순위: `docs/roadmap.md`.
- runtime 구조: `docs/repository-overview.md`, `src/`, `src-tauri/`.
- 상세 운영 계약: `docs/agent-operating-contract.md`; end-to-end loop: `docs/agent-autonomy-playbook.md`.
- repo overlay: `.agents/skills/loglens/SKILL.md`.

## Autonomy And Permissions

- 목표와 검증 경로가 명확한 로컬·가역 작업은 추가 승인 없이 구현, 검증, 문서화, local change 정리까지 진행한다.
- 외부 write, secret, 비용, 파괴적 작업, 제품 방향 변경, 승인되지 않은 원격 변경은 에스컬레이션한다.
- 파일 접근은 사용자가 선택한 canonical file과 Tauri capability scope로 제한한다.

## Execution Loop

1. `jj status`, status/roadmap, task-relevant source를 확인한다.
2. UI, parser/analysis, Tauri shell, file-access boundary 중 변경 경계를 고정한다.
3. 재현 가능한 fixture, smoke 또는 user-visible acceptance를 먼저 만든다.
4. focused check와 함께 최소 범위로 구현한다.
5. desktop/runtime surface의 가장 강한 자동 evidence를 실행하고 실패를 같은 루프에서 닫는다.
6. durable 상태는 status/roadmap/completed milestone 또는 operating docs에 반영한다.
7. 하나의 목적을 가진 `jj` change로 닫는다.

## Verification And Evidence

- Harness interface: `scripts/check-agent-harness-interface.sh`; repo harness: `pnpm check:harness`.
- 전체 local gate: `pnpm check`.
- selected-file/native surface: `pnpm check:runtime-smoke`; UI/parser 변경: focused Vitest와 필요한 desktop observation.
- 대용량 benchmark는 opt-in으로 유지하고 fast regression과 분리한다.
- 최종 증거에는 user-visible/native 결과, local/remote bookmark, CI를 포함한다.

## Escalation

`docs/agent-operating-contract.md`를 기준으로, 제품 판단, credential/private context, 파괴적 작업, native surface를 검증할 수 없는 실제 blocker, published history rewrite, 승인되지 않은 push가 필요한 경우에만 사용자에게 최소 판단을 요청한다.

## VCS And Publish

- 로컬 VCS는 `jj`를 사용하고 change description은 `<type>: <summary>`와 Codex trailer 규칙을 따른다.
- 기존 사용자 변경을 보존하고 논리 change 단위로 정리한다.
- 검증된 마일스톤만 로컬 `main`으로 전진시킨다.
- push 권한이 주어진 경우 `docs/agent-autonomy-playbook.md`의 PR/CI loop로 원격 commit과 GitHub Actions를 성공까지 확인한다.

## Harness Evaluation And Improvement

대표 desktop task에서 완료성, evidence 품질, 회귀율, runtime feedback latency, 비용을 평가한다. 반복 실패는 harness/GC check, runtime smoke, fixture 또는 concise operating rule로 기계화한다.

## Convergence

- `bridge`: 이 문서가 공통 인터페이스를 제공하고 기존 상세 문서를 연결한다.
- `normalized`: 중복된 autonomy, execution, verification, escalation, VCS 정책을 이 문서의 동일 섹션으로 이동한다.
- `canonical`: 프로젝트 목적, source, command, domain invariant는 같은 섹션 계약 안의 local content로 유지하고 공통 baseline, 제목 순서, 검사 골격은 동일하게 잠근다.
- 단계 전환은 현재 저장소의 Structure ID, 섹션 순서, canonical check 결과로 검증하며 다른 저장소의 이름·개수·로컬 경로·공개 여부를 전제하지 않는다.

## Project Overlay

- frontend file loading은 `allow_file_access` 승인 후에만 수행하고 path를 canonicalize한다.
- Tauri/Rust는 native 요구가 없는 한 얇은 desktop shell로 유지한다.
- large-log fast regression과 opt-in benchmark를 분리한다.

## Related Documents

- Operating policy: `docs/agent-operating-contract.md`, `docs/agent-autonomy-playbook.md`.
- Current state: `docs/status.md`, `docs/roadmap.md`.
- Runtime map: `docs/repository-overview.md`, `docs/log-format-support.md`.
- Completed work: `docs/completed-milestones.md`.
