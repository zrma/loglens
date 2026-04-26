# LogLens

로컬 `.log`/`.txt` 파일을 데스크톱에서 열어 빠르게 훑고 검색하는 Tauri 기반 로그 워크벤치입니다. 장기적으로는 Kibana나 로컬 log explorer처럼 로그 탐색, 관계 추적, span/trace 시각화, 디버깅 보조에 초점을 둔 로컬 분석 도구를 목표로 합니다. 현재 저장소는 초기 부트스트랩 단계이지만, 구조화 이벤트 추출과 trace 탐색의 최소 기능까지는 들어간 상태입니다.

## 프로젝트 의도

이 저장소는 "로컬 환경에서 가볍게 실행되는 로그 분석 워크벤치"를 지향합니다.

- 여러 로그를 빠르게 열고 검색할 수 있어야 한다.
- 로그 사이의 관계를 추적하고 디버깅 흐름을 재구성할 수 있어야 한다.
- trace/span 같은 실행 흐름을 시각적으로 탐색할 수 있어야 한다.
- 서버나 별도 인프라 없이 로컬에서 바로 분석을 시작할 수 있어야 한다.
- Kibana류 도구보다 설정 부담이 적고, 개발자 디버깅에 더 직접적으로 도움을 줘야 한다.

## 이 저장소가 하는 일

- Tauri 파일 선택 다이얼로그로 로그 파일 하나 이상을 연다.
- 선택한 텍스트 로그를 구조화 이벤트로 파싱한다.
- parser preset을 바꿔 같은 세션을 다른 alias 규칙으로 다시 읽을 수 있다.
- 세션 단위 field alias override로 팀별 short key나 변형 필드명을 보정할 수 있다.
- 여러 파일을 하나의 세션으로 병합하고 source 단위로 구분한다.
- 이벤트 목록과 상세 패널을 함께 보여준다.
- 이벤트 스트림 컬럼을 바꾸고 structured field를 컬럼으로 고정할 수 있다.
- 검색어, level, source, service, trace, request, structured field facet 조건으로 이벤트를 필터링한다.
- 인식 가능한 타임스탬프가 있는 로그에 대해 시간대별 분포를 시각화한다.
- trace/span/request ID를 추출해 관련 이벤트를 묶고 span topology와 timeline을 재구성한다.
- trace가 없더라도 route/resource/request 단서로 derived flow를 묶어 본다.
- 선택한 trace가 어떤 source들에 걸쳐 퍼져 있는지 source coverage로 보여준다.
- 멀티라인 stack trace, timestamp, JSON fallback, alias override, correlation field 상태를 Parser Diagnostics로 남긴다.
- 샘플 trace 세션을 불러와 UI를 바로 확인할 수 있다.
- sample session 기반 issue-only 필터와 analysis tab 전환은 agent-legible smoke test로 검증한다.
- 대용량 파서/분석 경계는 large-log fixture로 필터, 분포, 시간대 집계를 검증한다.
- 선택 파일 line-stream, fallback, scope failure, 대용량 UI windowing은 runtime smoke harness로 검증한다.

## 현재 구현 상태

### 구현된 기능

- `.log`, `.txt` 파일 다중 선택
- 라인 스트리밍 기반 로컬 파일 읽기
- 다중 파일 병합 세션과 source 표시/필터
- 구조화 이벤트 파싱(JSON line / key=value / plain text 일부, nested JSON field 추출, alias preset(auto/default/zap-short-json), 세션 단위 custom alias override, zap-style short key(`T/L/N/M/rid`) 지원, `traceparent` fallback, multiline stack trace 병합)
- 검색어, level, service, trace, request, structured field facet, issue-only 기반 필터링
- 선택 이벤트 상세 패널
- 관련 trace 이벤트 묶음 표시
- trace 내부 parent/child span topology 카드
- trace 상대 시간축 기준 span timeline 카드
- route/resource/request 기반 derived flow 그룹
- 이벤트 스트림 windowed/virtualized 렌더링
- 이벤트 스트림 builtin/source/request/trace 컬럼 토글
- structured field column pinning
- Parser Diagnostics severity/kind 분포와 이벤트별 line range 표시
- Field Facets 기반 field key/value drill-down, 포함/제외 조건, 다중 조건 조합
- Field Lens 기반 field key 토글과 상세 패널 field filter 액션
- `이벤트` / `분석` 탭 전환 UI
- 공통 로그 타임스탬프 형식 기반 시간대 집계
- 선택한 파일만 Tauri 파일 시스템 scope에 동적으로 허용
- 샘플 trace 세션 로드
- 파서/trace 분석 smoke test
- jsdom 기반 App UI smoke test

### 아직 구현되지 않은 부분

- 다양한 로그 포맷과 nested JSON에 대한 더 넓은 정규화
- 여러 파일 동시 비교를 더 깊게 지원하는 세션 관리
- span timeline/gantt 수준의 더 정교한 시각화
- 대용량 로그 대응 최적화
- 실제 파일 열기 플로우와 필터 상호작용까지 포함한 더 넓은 fixture/test 세트

현재 이벤트 목록은 DOM 폭증을 막기 위해 windowed list로 렌더링되고, 파일 파싱은 `readTextFileLines()` 기반 라인 스트리밍 경로를 우선 사용합니다.

현재 파서는 JSON line, key=value, plain text timestamp prefix, 일부 nested JSON correlation field, alias preset, 세션 단위 custom alias override, `traceparent` fallback, 일부 multiline stack trace를 지원합니다. 파싱 과정에서 생기는 timestamp 누락/실패, JSON fallback, key=value partial parse, alias override 적용, correlation field 누락은 severity와 kind가 있는 Parser Diagnostics로 확인할 수 있습니다. 저장소 목적은 "로그 분석 워크벤치"에 가깝고, 현재 구현은 "구조화 로그 탐색 + span 관계 탐색 MVP" 단계입니다.

## 구조 요약

- 프런트엔드: React + TypeScript + Vite
- 데스크톱 셸: Tauri v2
- UI: Tailwind CSS + shadcn/ui
- 차트: Recharts
- 네이티브 레이어 역할: 창 생성, 파일 선택 다이얼로그, 파일 시스템 접근 권한 제공

현재 로그 처리 로직은 `src/lib/logs`와 `src/features/log-explorer`로 나뉘어 있으며, Rust 쪽은 분석 엔진이라기보다 얇은 Tauri 셸에 가깝습니다.

## 주요 파일

- [`src/App.tsx`](./src/App.tsx): 세션 로드, 필터 상태, 탭 전환, 데이터 파이프 조립
- [`src/features/log-explorer/components`](./src/features/log-explorer/components): overview, sidebar, events, analysis 화면 컴포넌트
- [`src/features/log-explorer/presentation.tsx`](./src/features/log-explorer/presentation.tsx): 공용 badge, metric card, 강조 렌더링
- [`src/main.tsx`](./src/main.tsx): React 엔트리포인트
- [`src/lib/logs/parser.ts`](./src/lib/logs/parser.ts): 구조화 로그 파서, multiline 병합, parser diagnostics 생성
- [`src/lib/logs/aliases.ts`](./src/lib/logs/aliases.ts): parser alias preset과 short-key 매핑 정의
- [`src/lib/logs/analysis.ts`](./src/lib/logs/analysis.ts): 필터링, trace 그룹화, span forest, 시간대 집계
- [`src/lib/logs/sample.ts`](./src/lib/logs/sample.ts): 샘플 trace 세션 fixture
- [`src-tauri/src/lib.rs`](./src-tauri/src/lib.rs): Tauri 플러그인 등록과 선택 파일 단위 접근 허용
- [`src-tauri/capabilities/default.json`](./src-tauri/capabilities/default.json): 메인 창 권한 선언
- [`src-tauri/tauri.conf.json`](./src-tauri/tauri.conf.json): 개발 서버 연결, 창 크기, 번들 설정

더 자세한 내부 구조는 [`docs/repository-overview.md`](./docs/repository-overview.md)를 참고하세요.

제품 방향과 후속 작업은 [`docs/roadmap.md`](./docs/roadmap.md)에서 정리합니다.

현재 구현 상태와 다음 우선순위를 한 장으로 보려면 [`docs/status.md`](./docs/status.md)를 참고하세요.

다음 구현 배치의 상세 스펙은 [`docs/next-phase-spec.md`](./docs/next-phase-spec.md)에 정리했습니다.

에이전트가 사용자 개입 없이 작업을 진행할 때의 운영 계약은 [`AGENTS.md`](./AGENTS.md)와 [`docs/agent-operating-contract.md`](./docs/agent-operating-contract.md)를 기준으로 합니다. repo-local 세부 워크플로는 [`.agents/skills/loglens/SKILL.md`](./.agents/skills/loglens/SKILL.md)에 둡니다.

PR/CI 피드백 루프, 데스크톱 검증, 반복 품질 정리까지 포함한 자율 실행 절차는 [`docs/agent-autonomy-playbook.md`](./docs/agent-autonomy-playbook.md)에 둡니다.

## 실행

```bash
pnpm install
pnpm tauri dev
```

프런트엔드 정적 빌드만 만들려면:

```bash
pnpm build
pnpm test
```

전체 점검을 한 번에 돌리려면:

```bash
pnpm check
```

데스크톱 앱 번들을 만들려면:

```bash
pnpm tauri build
```

## 코드 품질 명령

```bash
pnpm check
pnpm check:harness
pnpm check:agent-gc
pnpm check:runtime-smoke
pnpm lint
pnpm lint:js
pnpm lint:rust
pnpm test
pnpm test:rust
pnpm format
pnpm format:rust
```

`pnpm check`는 `lint + test + build + cargo test`를 순서대로 실행합니다. `lefthook`의 `pre-push`와 GitHub Actions CI도 같은 명령을 사용합니다.
이 명령에는 `pnpm check:harness`와 `pnpm check:agent-gc`도 포함되며, 에이전트 운영 계약, 문서 지도, 자체 리뷰 루프, PR/CI 피드백 절차, 품질 GC 기준, UI smoke coverage, selected-file runtime smoke, 대용량 분석 fixture, 대용량 UI windowing fixture, 선택 파일 접근 경로가 현재 코드와 어긋나지 않는지 확인합니다.

런타임에 가까운 선택 파일 경로만 빠르게 다시 확인하려면:

```bash
pnpm check:runtime-smoke
```

이 명령은 Vitest 기반 `src/test/runtime-harness.test.tsx`와 Rust `allow_file_access` 테스트를 함께 실행합니다.

## VCS 워크플로

이 저장소는 Git 위에 `jj`를 공존시키는 방식으로 관리합니다. 새 클론에서 `jj`를 쓰려면 먼저 한 번 초기화합니다.

```bash
jj git init --colocate
jj bookmark track master --remote origin
```

그 다음 기본 확인 명령은:

```bash
jj st
jj diff
jj log -n 10
```

작업 메시지를 붙일 때는:

```bash
jj describe -m "feat: summary"
```

원격 `master`를 따라가는 기본 흐름은:

```bash
jj git fetch --remote origin
jj bookmark set master -r @
jj git push --remote origin -b master
```

로컬 빠른 방어선은 `lefthook pre-commit`, 무거운 검증은 `lefthook pre-push`와 GitHub Actions CI가 맡습니다.

## 권한과 보안 메모

- Tauri capability에는 `dialog`, `fs`, `opener` 권한이 선언되어 있습니다.
- 프런트엔드는 선택된 각 파일을 읽기 전에 Rust 커맨드 `allow_file_access`를 호출하고, 이 커맨드가 canonicalized 일반 파일만 파일 시스템 scope에 추가합니다.
- 제품 수준으로 발전시킬 때는 접근 기록, 다중 파일 세션, 분석 로직 분리까지 함께 설계하는 것이 좋습니다.

## 개발자 메모

- 현재 `README`는 "실제 구현된 기능" 기준으로 정리되어 있습니다.
- 2026-04-26 기준으로 repo-local 에이전트 운영 계약과 LogLens 전용 스킬을 추가했습니다.
- 2026-03-08 기준으로 JS audit 취약점은 전이 의존성 override까지 반영해 정리했습니다.
- 2026-03-09 기준으로 저장소는 `jj git init --colocate` 상태이며, 로컬 훅은 `lefthook`으로 관리합니다.
- 저장소 안에는 Tauri 기본 템플릿 흔적이 일부 남아 있으며, 대표적으로 [`src/App.css`](./src/App.css)는 현재 엔트리포인트에서 import되지 않습니다.

## 라이선스

MIT
