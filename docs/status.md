# 현재 상태

## 한 줄 요약

LogLens는 지금 `로컬 로그 파일 -> 구조화 이벤트 파싱 -> trace/span 관계 탐색 -> 기본 분석 차트`까지 가능한 데스크톱 로그 워크벤치 MVP 상태입니다.

## 지금까지 완료된 것

- Tauri 기반 데스크톱 셸과 Vite/React 프런트엔드 부트스트랩
- 선택한 `.log`/`.txt` 파일만 접근 허용하는 파일 열기 플로우
- 여러 `.log`/`.txt` 파일을 하나의 세션으로 병합하는 로딩 플로우
- 구조화 로그 파서
  - JSON line
  - key=value
  - plain text timestamp prefix 일부
  - multiline stack trace 병합
  - nested JSON correlation field 추출
  - parser alias preset(`auto`, `default`, `zap-short-json`)
  - 세션 단위 custom alias override UI
  - severity/kind 기반 Parser Diagnostics
    - `timestamp_missing`
    - `timestamp_parse_failed`
    - `json_parse_failed`
    - `structured_parse_fallback`
    - `key_value_partial_parse`
    - `alias_override_applied`
    - `correlation_field_missing`
  - zap-style short key(`T/L/N/M/rid`) 처리
  - `traceparent` 기반 trace/span fallback
- 이벤트 도메인 모델 정리
  - `timestamp`
  - `level`
  - `service`
  - `message`
  - `traceId`
  - `spanId`
  - `parentSpanId`
  - `requestId`
- 탐색 UI
  - 검색어 필터
  - level/source/service/trace/request 필터
  - structured field facet drill-down
  - structured field 포함/제외 조건
  - 다중 field 조건 조합
  - issue-only 토글
  - 이벤트 목록
  - windowed/virtualized event stream
  - event stream column 토글
  - structured field column pinning
  - 상세 이벤트 패널
  - Parser Diagnostics 표시
  - raw block 표시
  - field key visibility 토글
- 관계 추적 UI
  - trace group 요약
  - derived flow group 요약
  - cross-file Trace Diff
  - source별 missing span/service/route/method hint
  - span topology 트리
  - span timeline
- 분석 UI
  - 시간대 분포 차트
  - level/service/request/Parser Diagnostics 분포
  - analysis drill-down filter chip
  - 차트/분포 클릭 기반 이벤트 범위 좁히기
  - 분석 조건 개별 해제와 분석 조건만 해제
- 샘플 trace 세션 fixture
- 테스트
  - parser/analysis smoke test
  - jsdom 기반 App smoke test
  - sample session 기반 issue-only 필터와 분석 탭 전환 smoke test
  - analysis drill-down 적용/해제 smoke test
  - Tauri 파일 선택/라인 스트리밍 경로 mock smoke test
  - selected-file runtime smoke
    - Tauri `allow_file_access` 호출 후 line-stream 읽기
    - line-stream 실패 시 whole-file fallback
    - scope 실패 시 파일 읽기 차단
    - 3,000-event 대용량 UI windowing row bound
  - async line stream parser test
  - 대용량 분석 fixture 기반 필터/분포/시간대 집계 test
  - 대용량 세션 top trace/derived-flow preview와 선택 flow lazy materialization test
  - 대용량 세션 field facet 단일 scan snapshot test
  - opt-in 200k-line large session benchmark candidate
  - cross-file Trace Diff analysis fallback test
  - 다중 파일 세션 Trace Diff UI smoke test
  - selected-file 검색/level/source/field facet 조합 UI smoke test
  - nested JSON / Go panic stack fixture test
  - timestamp missing/parse failed, JSON fallback, alias override diagnostic test
  - documented timestamp format regression test
  - out-of-order trace와 missing-parent span forest edge test
- 에이전트 하네스 검증
  - `pnpm check:harness`로 AGENTS 지도, 운영 계약, 자체 리뷰 루프, publish/CI/pre-push gate, 파일 access scope, selected-file runtime smoke, UI smoke coverage, 대용량 분석 fixture, 대용량 UI windowing fixture, ordered backlog, 주요 문서 드리프트 확인
- 자율 실행 하네스
  - `docs/agent-autonomy-playbook.md`로 end-to-end 실행, 데스크톱 검증, PR/CI 피드백 루프, 품질 GC 절차 문서화
  - `pnpm check:agent-gc`로 자율 실행 플레이북, 품질 GC 기준, unresolved debt marker, 개인 절대 경로 누출 확인
- 번들 최적화
  - `AnalysisTab` lazy load 분리
  - 기존 chunk size warning 제거
- 파일 로드 최적화
  - `readTextFileLines()` 기반 라인 스트리밍 파싱
  - 파싱 진행 상태 표시
- 대용량 파생 계산 최적화
  - 이벤트 필터와 analysis drill-down을 한 predicate 경로로 결합
  - sidebar/analysis의 상위 trace/derived-flow 목록을 bounded preview로 계산
  - 선택 이벤트 상세에서 필요한 derived-flow만 lazy materialize
  - field facet key/value count를 단일 snapshot 계산으로 결합
  - 빠른 large regression과 느린 200k-line benchmark 후보 분리

## 현재 구현 수준

현재 제품 성격은:

- 단순 로그 뷰어보다는 강함
- Kibana급 완성형 분석 도구보다는 훨씬 초기
- “개발자 로컬 디버깅용 structured log explorer”로는 방향이 명확한 상태

즉, 지금은 “의도 검증이 끝난 MVP”에 가깝고, 다음부터는 기능 확장보다 `신뢰성`, `성능`, `관계 시각화 고도화`가 중요합니다.

## 지금 바로 되는 것

- 샘플 세션 로드 후 trace/span 흐름 탐색
- 실제 로그 파일 1개 열기
- 실제 로그 파일 여러 개를 한 세션으로 열기
- zap-style JSON access log를 request/service/timestamp 기준으로 읽기
- parser preset을 바꿔 같은 세션을 다시 읽기
- 필드 매핑 UI에서 세션 단위 alias override를 적용하고 다시 파싱하기
- 세션 요약, 분석 탭, 이벤트 상세에서 Parser Diagnostics kind/severity 확인하기
- 문제 이벤트만 골라 보기
- 특정 source/service/request/trace 기준으로 좁혀 보기
- 분석 탭의 시간대/level/service/request/diagnostic 분포를 클릭해 이벤트 범위 좁히기
- 분석 탭에서 만든 drill-down 조건을 chip으로 확인하고 개별 또는 전체 해제하기
- 특정 structured field key/value facet으로 누적 조건 걸기
- 특정 structured field 값을 제외 조건으로 빼고 보기
- multiline 오류를 하나의 이벤트로 읽기
- trace 내 span 부모/자식 관계 확인
- trace 내 span 상대 시간축 확인
- 같은 trace가 여러 source에 걸쳐 있는지 source별 event/duration/missing hint로 비교하기
- trace가 없을 때 requestId 또는 derived flow 기준으로 source별 차이 비교하기
- trace가 없어도 route/resource/request 기준으로 REST 흐름 묶어 보기

## 아직 부족한 것

- 로그 포맷 지원 범위가 아직 좁음
  - nested JSON 정규화 범위 확대
  - 더 많은 timestamp 포맷
  - 언어별 stack trace 패턴 확대
- 파일 처리 규모가 작음
  - 라인 스트리밍 파싱 뒤에는 전체 이벤트/집계를 여전히 메모리에 유지
  - event stream은 windowed list지만 상세/집계는 점진 계산이 아님
- 시각화가 아직 기본형
  - span timeline은 있지만 gantt 수준 상호작용 없음
  - source diff는 있지만 trace 간 비교 없음
- 테스트 범위가 아직 얕음
  - 선택 파일 플로우는 runtime smoke로 보강됐지만, 실제 Tauri 데스크톱 창 자동화는 아직 없음
  - 필터 상호작용은 issue-only와 sample analysis smoke부터 보강된 상태
  - 대용량 fixture는 parser/analysis count, UI windowing smoke, opt-in 200k-line benchmark candidate 중심이며, 실제 브라우저/데스크톱 렌더링 성능 측정은 아직 없음

## 현재 리스크

- 대용량 로그에서 렌더링/메모리 비용이 커질 수 있음
- 대용량 로그에서 전체 이벤트 배열과 전체 집계는 여전히 메모리에 유지됨
- 파서 heuristic이 강해서 예상 밖 포맷에서 필드 추출 정확도와 일부 diagnostic 분류가 흔들릴 수 있음
- custom alias override는 현재 세션 단위이며 영구 저장이나 import/export는 아직 없음
- Tauri 실제 데스크톱 창 자동화는 아직 없고, 선택 파일 계약은 focused runtime smoke로 보강된 상태
- 하네스 검증은 UI smoke, selected-file runtime smoke, 대용량 분석/UI fixture, 자율 실행 플레이북 존재까지 확인하지만, UI 동작 전체를 대신하지는 않음
- PR/CI 피드백 루프는 문서화됐지만 GitHub 인증이나 PR 생성 권한은 실행 환경에 따라 별도 확인이 필요함
- `jj`는 clone마다 `jj git init --colocate`를 한 번 해줘야 한다

## 다음 우선순위

완료된 기능 마일스톤은 [`docs/next-phase-spec.md`](./next-phase-spec.md)에 남기고, 후속 유지보수 작업은 [`docs/todo-maintenance-gc.md`](./todo-maintenance-gc.md)를 기준으로 진행합니다.

### 완료. Custom Alias Override UI

- 세션 단위 alias override 추가
- preset 위에 사용자 매핑 덮어쓰기
- override 적용 시 즉시 재파싱

### 완료. Parser Diagnostics 강화

- 파싱 실패 이유 분류 세분화
- timestamp/structured fallback 설명 강화
- alias override와 연결되는 진단 힌트 추가

### 완료. Analysis Drill-down 연결

- 차트 클릭으로 필터 반영
- 카드/분포와 facet 상태 연결
- 이벤트 탭과 분석 탭 간 drill-down 상태 유지

### 완료. Cross-file Trace Diff

- trace 기준 source별 비교 카드
- trace가 없을 때 requestId 또는 derived flow fallback
- source coverage를 diff 수준으로 확장

### 완료. 대용량 세션 메모리 최적화

- 이벤트 탭이 활성화된 경우에만 상세 패널 전용 선택 이벤트 계산 수행
- Trace Diff는 다중 source 세션에서만 계산
- 이벤트 필터와 analysis drill-down을 한 pass로 결합해 중간 배열 생성 축소
- sidebar/analysis의 top trace/derived-flow는 표시 개수에 맞춘 bounded preview 사용
- field facet key/value count는 선택 facet key 기준 단일 scan snapshot 사용
- fast large regression은 3,000-event parser/runtime fixture로 유지
- 200k-line large session benchmark 후보는 `pnpm bench:large-session`으로 opt-in 실행
- 파생 계산 캐시/지연 계산
- 필터/집계 메모리 비용 절감

### 1. 신뢰성 보강

작업 목록은 [`docs/todo-reliability-hardening.md`](./todo-reliability-hardening.md)에 둔다.

- 지원 timestamp 형식과 parse failure 규칙 문서화 완료: [`docs/log-format-support.md`](./log-format-support.md)
- timestamp 변형과 parse failure 분류 parser test 보강 완료
- trace/span 집계 edge case test 보강 완료
- 실제 파일 열기 플로우와 필터 상호작용 UI 테스트 확장 완료
- 품질 GC와 하네스 기준을 반복 드리프트에 맞춰 보강 완료

### 2. 유지보수 GC

작업 목록은 [`docs/todo-maintenance-gc.md`](./todo-maintenance-gc.md)에 둔다.

- 미사용 `src/App.css` 템플릿 잔재 삭제 완료
- README와 상태 문서의 대용량 최적화 설명 드리프트 정리 완료
- `src/App.tsx` 필터 상태 분리 완료: [`docs/todo-app-state-split.md`](./todo-app-state-split.md)
- 다음 배치에서 view configuration 또는 파생 계산 추가 분리 여부 재검토
- 디자인 시스템 컴포넌트 사용 범위 재점검
- 번들 split 이후 청크 크기와 lazy boundary 재점검

## 지금 당장 하지 않아도 되는 것

- Rust 분석 엔진화
- SQLite/인덱싱
- 외부 로그 소스 import
- 팀 공유 기능

## 재시작할 때 보면 좋은 파일

- [`README.md`](../README.md)
- [`docs/repository-overview.md`](./repository-overview.md)
- [`docs/roadmap.md`](./roadmap.md)
- [`src/App.tsx`](../src/App.tsx)
- [`src/lib/logs/parser.ts`](../src/lib/logs/parser.ts)
- [`src/lib/logs/analysis.ts`](../src/lib/logs/analysis.ts)
- [`src/features/log-explorer/components/EventsTab.tsx`](../src/features/log-explorer/components/EventsTab.tsx)

## 검증 기준

현재 기본 검증 명령은 아래입니다.

```bash
pnpm check
```

`pnpm check`는 `pnpm lint`, `pnpm check:harness`, `pnpm check:agent-gc`, `pnpm test`, `pnpm build`, `pnpm test:rust`를 순서대로 실행합니다. `lefthook pre-push`와 GitHub Actions CI도 같은 명령을 사용합니다.

선택 파일 런타임 계약만 빠르게 확인하려면 아래 명령을 사용합니다.

```bash
pnpm check:runtime-smoke
```

대용량 경계는 기본 gate에 들어가는 빠른 회귀와 opt-in benchmark로 나눕니다.

```bash
pnpm test:large-regression
pnpm bench:large-session
```
