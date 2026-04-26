# 대용량 세션 메모리 최적화 작업 목록

## 목표

라인 스트리밍 파싱 이후에도 남아 있는 전체 이벤트 배열, 필터 결과 배열, 파생 집계 계산 비용을 줄여 큰 로그 세션에서 탐색 UI가 멈추지 않게 한다.

## 구현 항목

- [x] 현재 대용량 fixture와 UI windowing smoke가 잡는 범위와 빠지는 범위를 정리한다.
- [x] large fixture 기준으로 파생 계산별 입력 크기와 재계산 경로를 문서화한다.
- [x] 이벤트 목록, field facet, analysis chart, trace/derived flow, source diff 계산의 중복 배열 생성을 줄인다.
- [x] 선택 이벤트가 없거나 상세 패널에 필요하지 않은 trace/span/source diff 계산을 지연한다.
- [x] sidebar top trace/derived flow 계산을 현재 필터 범위와 표시 개수에 맞춰 bounded path로 분리한다.
- [ ] field key/value facet 계산을 선택된 facet key 중심으로 좁히거나 cache한다.
- [ ] large fixture smoke를 200k 라인 목표로 확장하기 전, 빠른 regression fixture와 느린 benchmark 후보를 분리한다.
- [ ] 최적화 전후 기준을 docs/status.md 또는 이 문서에 남긴다.
- [x] README, docs/status.md, docs/repository-overview.md, docs/next-phase-spec.md에 구현 상태를 반영한다.

## 수용 기준

- 기존 검색, 필터, analysis drill-down, Trace Diff UI 동작이 유지된다.
- 대용량 세션에서 불필요한 trace/span/source diff 계산이 선택 이벤트나 표시 상태에 맞춰 지연된다.
- 중복 필터 배열이나 파생 집계 배열 생성이 최소 한 군데 이상 줄어든다.
- large-log 관련 test 또는 runtime smoke가 최적화 경로를 검증한다.
- 최적화 전후 기준과 남은 병목이 문서에 남는다.
- `pnpm test`, `pnpm build`, `pnpm lint:js`, `pnpm check`가 통과한다.

## 작업 순서

1. 상세 패널 전용 계산을 선택 이벤트 기준으로 지연한다.
2. sidebar/analysis에서 항상 필요한 집계와 상세 패널 전용 집계를 분리한다.
3. field facet 계산의 중복 필터 경로를 줄인다.
4. large fixture 기준을 확장하고 benchmark/slow smoke 후보를 분리한다.
5. 문서와 하네스 기준을 현재 구현 상태에 맞춘다.

## 현재 large fixture 기준

- Parser/analysis fixture는 `src/lib/logs/parser.test.ts`의 3,000-event mixed JSON stream으로 필터, level/service/request 분포, 시간대 집계, top trace/derived-flow preview, 선택 flow lazy 계산을 확인한다.
- Runtime fixture는 `src/test/runtime-harness.test.tsx`의 3,000-event selected-file stream으로 Tauri line stream, selected-file scope, windowed event row bound를 확인한다.
- 아직 빠지는 범위는 200k 라인급 느린 benchmark, 실제 데스크톱 창의 렌더링 시간 측정, 전체 이벤트 배열 자체의 메모리 상한 측정이다.
- 현재 재계산 경로는 기본 필터 결과(`filteredEvents`)를 중심으로 유지하되, sidebar와 analysis의 상위 trace/derived-flow 목록은 `buildTopTraceGroupPreviews()`와 `buildTopDerivedFlowGroupPreviews()`가 표시 개수만 반환한다. 선택 event 상세에서 필요한 derived-flow는 `buildDerivedFlowGroupForEvent()`로 해당 flow만 materialize한다.

## 검증

- `pnpm test -- src/test/runtime-harness.test.tsx src/test/app.smoke.test.tsx`
- `pnpm test -- src/lib/logs/parser.test.ts`
- `pnpm lint:js`
- `pnpm build`
- `pnpm check`

## 진행 메모

- 2026-04-26: 이벤트 탭이 활성화된 경우에만 선택 이벤트 상세 계산을 수행하고, Trace Diff는 다중 source 세션에서만 계산하도록 좁혔다. Focused 검증은 `pnpm test -- src/test/runtime-harness.test.tsx src/test/app.smoke.test.tsx`로 통과했다.
- 2026-04-26: `filterLogEvents`와 analysis drill-down을 한 predicate 경로로 결합해 최종 이벤트 필터 결과를 만들기 전 중간 배열 생성을 줄였다. Focused 검증은 `pnpm test -- src/lib/logs/parser.test.ts src/test/app.smoke.test.tsx`로 통과했다.
- 2026-04-26: sidebar/analysis의 상위 trace와 derived-flow 목록을 bounded preview 함수로 분리하고, 선택 이벤트의 derived-flow만 lazy materialize하도록 좁혔다. Focused 검증은 `pnpm test -- src/lib/logs/parser.test.ts`로 확인한다.
