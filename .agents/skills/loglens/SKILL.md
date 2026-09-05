---
name: loglens
description: "LogLens 전용 workflow. 이 저장소에서 Tauri/React 기반 local log analysis workbench의 제품 동작, parser/analysis 로직, UI, 문서, 검증, release/publish workflow를 변경할 때 사용한다."
---

# LogLens Project Skill

## 사용 시점

이 저장소에서 아래 영역을 건드리는 작업에 사용합니다.

- `src/lib/logs/`의 parser 또는 analysis 동작
- `src/App.tsx` 또는 `src/features/log-explorer/`의 explorer UI
- `src-tauri/`의 Tauri file access 또는 desktop integration
- 문서, 테스트, 검증, publish workflow

## 먼저 볼 파일

- `AGENTS.md`
- `docs/agent-operating-contract.md`
- `docs/agent-autonomy-playbook.md`
- `docs/status.md`
- `docs/roadmap.md`
- `docs/analysis-contract.md`
- `docs/completed-milestones.md`
- `docs/repository-overview.md`

현재 작업에 필요한 부분만 읽습니다.

## 제품 프레임

LogLens는 local desktop log workbench입니다. 개발자가 외부 인프라 없이 로컬 `.log`와 `.txt` 파일을 열고, structured event로 파싱하고, 빠르게 search/filter하며, trace/span/request 관계를 따라갈 수 있게 해야 합니다.

범위 구분:

- **기본 범위**: local file session, parser diagnostics, field facets, trace/span exploration, dense debugging UI, local validation
- **기본 비범위**: hosted service, shared team state, external log ingestion, broad filesystem access, permanent parser preset storage

## 구현 규칙

- Canonical log field는 안정적으로 유지합니다: `timestamp`, `level`, `service`, `message`, `traceId`, `spanId`, `parentSpanId`, `requestId`.
- Parser 변경에는 `src/lib/logs/parser.test.ts`의 대표 테스트가 필요합니다.
- Analysis 변경에는 영향을 받는 analysis 동작 근처의 테스트가 필요합니다.
- UI 변경은 현재의 dense workbench 스타일을 유지하고 marketing-page pattern을 피합니다.
- Tauri 변경은 user-selected file로 file access 범위를 제한해야 합니다.
- 작업이 native processing을 명시적으로 요구하지 않는 한 Rust를 log analysis engine으로 바꾸지 않습니다.

## 검증

반복 중에는 아래 명령에서 변경된 표면에 해당하는 focused check만 선택합니다. 이 목록 전체를 매번 실행하지 않습니다.

```bash
pnpm check:harness
pnpm check:agent-gc
pnpm check:runtime-smoke
pnpm lint:js
pnpm lint:rust
pnpm test
pnpm build
pnpm test:rust
```

Commit 또는 push 전에는 아래를 실행합니다.

```bash
pnpm check
```

사용자가 보는 UI 동작이 바뀌면 앱의 sample trace session 또는 변경된 흐름을 확인합니다. 스킬·문서만의 변경에 새로운 UI 테스트를 만들지 않습니다. 필수 gate가 통과하면 새 변경·실패·미해결 위험 없이 반복하지 않습니다.

운영 계약, 문서 지도, 선택 파일 접근 경로를 바꾼 경우에는 `pnpm check:harness`를 먼저 실행해 repo-local 하네스가 드리프트하지 않는지 확인합니다.

자율 실행 절차, PR/CI 피드백 루프, 또는 품질 GC 기준을 바꾼 경우에는 `pnpm check:agent-gc`도 먼저 실행합니다.

파일 선택, Tauri fs scope, line-stream fallback, 대용량 UI windowing 근처를 바꾼 경우에는 `pnpm check:runtime-smoke`를 먼저 실행합니다.

## 자율성과 에스컬레이션

요청과 현재 repository contract로 결정할 수 있는 local 작업은 구현·검증까지 진행합니다. 제품 판단, 대상, 비용·노출 또는 권한에 실질적인 공백이 있을 때만 질문합니다. 승인이 빠진 단계 직전까지 diff와 검증을 준비하고, 이미 승인된 action/target을 다시 확인하지 않습니다.

스킬의 권장 절차를 새 승인 조건으로 해석하지 않습니다. 스킬 때문에 멈춘다면 해당 `SKILL.md` 링크와 정확한 문구를 인용해 실제 요구와 해석을 구분합니다. 명시된 모델은 보존하고, 실행 지침 갱신을 runtime model 변경으로 확대하지 않습니다.

사용자가 push까지 요청했다면 로컬 검증을 끝내고 `jj` description·target bookmark·push와 remote/CI 결과까지 확인합니다. commit-only 요청은 local change와 새 empty working copy로 닫으며 default bookmark를 옮기지 않습니다.

## VCS

`jj`를 사용합니다.

```bash
jj status
jj diff
# 전역 vcs-jj attribution protocol로 change description을 설정하고 검증한다.
jj new
```

승인된 publication일 때만 intended revision으로 target bookmark를 옮기고 push합니다. local closeout 명령 예시는 publication 권한을 만들지 않습니다.

Commit message는 scope 없는 `<type>: <summary>` 형식을 쓰고 Codex co-author trailer를 정확히 한 번 포함합니다.
