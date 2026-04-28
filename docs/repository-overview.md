# 저장소 개요

## 한 줄 요약

이 저장소는 Tauri 데스크톱 셸 위에서 React UI로 로컬 로그 파일을 열고, 구조화 이벤트로 파싱하고, trace/span 단서를 기준으로 탐색하는 로그 워크벤치 프로토타입입니다. 제품 의도는 그보다 더 넓어서, 장기적으로는 로컬 로그 분석과 trace/span 탐색까지 지원하는 디버깅 워크벤치를 목표로 합니다.

## 제품 방향

현재 코드베이스에서 읽히는 기능은 단순 로그 뷰어지만, 프로젝트 의도는 다음 방향에 가깝습니다.

- 로그를 모아 빠르게 검색하고 필터링한다.
- 서로 다른 로그 이벤트 사이의 상관관계를 따라간다.
- 요청 단위의 흐름을 trace/span처럼 시각화한다.
- 장애 분석과 디버깅에 필요한 컨텍스트를 한 화면에서 탐색한다.

즉, "로그 파일 열기 앱"이 최종 목적이 아니라, 로컬 개발/운영 디버깅을 위한 분석 도구가 목표입니다.

## 현재 사용자 플로우

1. 사용자가 `로그 파일 선택` 버튼을 누른다.
2. Tauri dialog 플러그인으로 `.log` 또는 `.txt` 파일 하나 이상을 고른다.
3. 프런트엔드가 선택된 파일 경로를 받아 `allow_file_access` 커맨드로 해당 파일만 Tauri fs scope에 추가한다.
4. `readTextFileLines()` 기반 라인 스트리밍 경로로 텍스트 파일을 읽고, 필요한 경우 전체 파일 읽기로 fallback한다.
5. 선택한 parser preset과 세션 단위 field alias override를 적용해 파일 내용을 구조화 이벤트로 파싱한다.
6. 검색어, level, service, trace, request, issue-only 기준으로 이벤트를 필터링한다.
7. `이벤트` 탭에서 windowed 이벤트 목록과 상세 패널을 보여준다.
8. 선택한 이벤트에 traceId가 있으면 관련 이벤트 흐름과 span topology를 묶어 보여준다.
9. 같은 trace 안의 span을 상대 시간축 timeline으로 보여준다.
10. trace/request/derived flow 기준으로 source별 event count, duration, missing span/service/route/method hint를 비교한다.
11. Parser Diagnostics와 멀티라인 line range를 세션 요약, 분석 탭, 상세 패널에서 확인한다.
12. `분석` 탭에서는 인식 가능한 타임스탬프를 파싱해 시간대별 추이와 분포를 보여준다.
13. 분석 탭의 시간대, level, service, request, diagnostic 분포를 클릭하면 별도 drill-down 조건으로 이벤트 범위를 좁힌다.
14. `필드 매핑` 다이얼로그에서는 canonical field alias를 보정하고 현재 세션을 다시 파싱한다.
15. `Export`/`Import` 컨트롤로 raw 로그 본문 없이 parser/view/filter 상태만 담은 로컬 JSON snapshot을 저장하거나 복원한다.

## 런타임 구조

### Frontend

- 위치:
- [`src/App.tsx`](../src/App.tsx)
- [`src/features/log-explorer/components`](../src/features/log-explorer/components)
- [`src/features/log-explorer/presentation.tsx`](../src/features/log-explorer/presentation.tsx)
- 역할:
- 파일 선택과 샘플 세션 로드
- 선택 파일 단위 Tauri fs scope 허용
- 라인 스트리밍 기반 파일 읽기와 fallback
- parser preset과 세션 단위 field alias override 관리
- 구조화 이벤트 기준 상태 관리
- 검색어/level/service/trace/request/issue 필터링
- windowed 이벤트 스트림, 선택 이벤트 상세 패널, Parser Diagnostics, span topology, span timeline 렌더링
- trace/request/derived flow 기준 source diff와 missing hint 렌더링
- 시간대별 집계 차트, 분포 카드, analysis drill-down chip 렌더링
- sidebar/analysis 상위 trace/derived-flow 목록은 표시 개수에 맞춘 bounded preview로 계산
- 이벤트/분석 탭 전환
- raw 로그 본문을 저장하지 않는 session snapshot export/import

`App.tsx`는 세션 로딩, 탭, 선택 이벤트 상태, session snapshot 적용 순서를 연결하고, 필터 상태는 `useLogExplorerFilters()`, 표시 설정은 `useLogExplorerViewConfig()`, 파생 view data는 `useLogExplorerViewModel()`이 맡습니다. 실제 렌더링 덩어리는 `src/features/log-explorer/components`로 분리되었습니다.

### Tauri / Rust

- 위치: [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)
- 역할:
- `tauri-plugin-dialog`, `tauri-plugin-fs`, `tauri-plugin-opener` 초기화
- 선택 파일 단위 파일 시스템 scope 설정
- 앱 실행 부트스트랩

중요한 점은, 현재 Rust 레이어가 로그 파싱이나 집계를 수행하지 않는다는 것입니다. Rust는 네이티브 기능 접근과 접근 범위 제어를 제공하는 얇은 셸 역할에 가깝습니다.

## 주요 상태와 데이터 흐름

- `session`: 파싱된 이벤트와 parser diagnostics를 담는 세션
- `parserPresetId`, `aliasOverrides`
- `searchTerm`, `levelFilter`, `serviceFilter`, `traceFilter`, `requestFilter`, `issuesOnly`, `analysisDrillDownFilters`
- `selectedEventId`
- `activeTab`
- `errorMessage`

데이터 흐름은 `파일 선택 -> 선택 파일 scope 허용 -> 라인 스트리밍 읽기 -> 이벤트 레코드 분리 -> preset/alias override 적용 -> 구조화 파싱 -> trace/span 집계 -> sidebar 필터 -> analysis drill-down 필터 -> 탭 렌더링` 순서입니다.

Session snapshot은 별도 경로입니다. export는 현재 parser preset, alias override, 필터, analysis drill-down, event stream column, field visibility, active tab, source signature만 JSON으로 저장하고 raw log line이나 parsed event 전체는 저장하지 않습니다. import는 현재 로드된 세션에 이 상태를 적용하며, parser 설정이 다르면 같은 세션을 다시 파싱한 뒤 필터와 view 상태를 복원합니다.

## 폴더별 역할

- [`src`](../src): React 애플리케이션 본체
- [`src/components/ui`](../src/components/ui): shadcn/ui 기반 공용 UI 컴포넌트
- [`src/lib/logs`](../src/lib/logs): 로그 도메인 타입, 파서, 분석 로직, 샘플 fixture, 테스트
- [`src-tauri`](../src-tauri): Tauri 설정과 Rust 엔트리포인트
- [`public`](../public): 정적 에셋
- [`docs/log-format-support.md`](./log-format-support.md): timestamp 지원 범위와 Parser Diagnostics 규칙
- [`docs/todo-correlation-rules.md`](./todo-correlation-rules.md): HTTP/B3 correlation header를 canonical field로 승격하는 완료된 작업
- [`docs/todo-xray-correlation-rules.md`](./todo-xray-correlation-rules.md): AWS X-Ray trace header를 canonical trace/span fallback으로 승격한 완료된 작업
- [`docs/todo-otel-log-fields.md`](./todo-otel-log-fields.md): OpenTelemetry/OTLP-style JSON log field를 canonical field로 승격한 완료된 작업
- [`docs/todo-session-snapshots.md`](./todo-session-snapshots.md): raw 로그 없는 로컬 분석 session snapshot export/import를 추가한 완료된 작업

## 현재 한계

- 파서는 JSON line, key=value, plain text timestamp prefix와 일부 stack trace heuristics까지만 안정적으로 지원한다.
- span 관계 시각화는 기본 트리와 상대 timeline 수준이고, gantt 수준 상호작용은 아직 없다.
- 파일 읽기는 라인 스트리밍이고 이벤트 목록은 windowed 렌더링이지만, 전체 이벤트/집계는 여전히 메모리에 유지한다. 다만 sidebar/analysis 상위 flow 목록과 선택 이벤트 derived-flow 상세는 bounded/lazy 경로로 분리되었다.
- Trace Diff는 source별 coverage와 missing hint 중심이며 완전한 distributed trace 재구성은 아니다.
- Session snapshot은 parser/view/filter 상태만 저장하며 raw 로그 본문, 자동 파일 재열기, 장기 인덱싱은 포함하지 않는다.
- Parser Diagnostics는 timestamp, JSON fallback, alias override, correlation 누락을 설명하지만, 지원 로그 포맷 자체는 아직 제한적이다.
- 테스트는 parser/trace smoke, jsdom 기반 파일 선택 UI smoke, selected-file runtime smoke, 3,000-event UI windowing smoke를 포함한다. 실제 Tauri 데스크톱 창 자동화는 아직 수동 확인 비중이 크다.

## 유지보수 관점에서 중요한 사실

- [`src-tauri/capabilities/default.json`](../src-tauri/capabilities/default.json) 에 파일 열기와 파일 시스템 접근 권한이 선언되어 있습니다.
- [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs) 는 `allow_file_access` 커맨드로 사용자가 고른 파일만 접근 허용합니다.
- 현재 엔트리포인트는 [`src/index.css`](../src/index.css)만 전역 스타일로 import합니다.
- [`docs/agent-autonomy-playbook.md`](./agent-autonomy-playbook.md)는 PR/CI 피드백 루프, 데스크톱 검증, 품질 GC 절차의 source of truth입니다.

## 다음에 손대기 좋은 영역

- correlation ID를 포함한 더 풍부한 연결 규칙
- 큰 파일 대응을 위한 스트리밍/가상화
- span timeline/gantt 시각화
- raw 로그를 포함하지 않는 bookmark/annotation 같은 분석 보조 상태
- 실제 파일 열기/필터 상호작용을 포함한 UI 테스트와 fixture 확장
