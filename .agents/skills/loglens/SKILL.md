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
- `docs/status.md`
- `docs/next-phase-spec.md`
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

반복 중에는 focused check를 사용합니다.

```bash
pnpm check:harness
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

UI 비중이 큰 작업은 가능하면 앱을 실행하고 sample trace session 또는 변경된 흐름을 확인합니다.

운영 계약, 문서 지도, 선택 파일 접근 경로를 바꾼 경우에는 `pnpm check:harness`를 먼저 실행해 repo-local 하네스가 드리프트하지 않는지 확인합니다.

## 자율성과 에스컬레이션

기본값은 자율 진행입니다. 사용자는 `docs/agent-operating-contract.md`에 적힌 경우에만 호출합니다: 권한 누락, 요청되지 않은 파괴적 작업, 해결되지 않은 제품 판단 공백, 외부 비용/노출, 지침 충돌, 검증 차단.

사용자가 commit/push를 요청했다면 로컬 검증을 끝내고, `jj` change description을 설정하고, target bookmark를 갱신하고, 새 민감/파괴 리스크가 드러나지 않는 한 추가 확인 없이 push합니다.

## VCS

`jj`를 사용합니다.

```bash
jj status
jj diff
jj describe -m $'docs: summary\n\nCo-authored-by: Codex (AI-generated) <codex@1day1coding.com>'
jj bookmark set master -r @
jj git push --remote origin -b master
```

Commit message는 scope 없는 `<type>: <summary>` 형식을 쓰고 Codex co-author trailer를 정확히 한 번 포함합니다.
