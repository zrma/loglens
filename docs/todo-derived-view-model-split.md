# 파생 view model 분리 작업 목록

## 목표

`src/App.tsx`에 남아 있던 필터 결과, facet snapshot, trace/source diff, metric 카드 계산을 전용 hook으로 옮긴다. 화면 엔트리포인트는 세션 로딩, 탭 전환, 선택 이벤트 상태처럼 사용자 흐름을 연결하는 책임만 남긴다.

## 구현 항목

- [x] `src/features/log-explorer/hooks/useLogExplorerViewModel.ts`를 추가한다.
- [x] 필터 적용 결과와 analysis drill-down 결합을 hook 내부로 이동한다.
- [x] field facet snapshot, trace/derived-flow preview, source diff, span forest 계산을 hook 내부로 이동한다.
- [x] metric 카드와 session summary view data를 hook 내부에서 구성한다.
- [x] 기존 `useLogExplorerViewConfig()`는 view model hook이 조합해 사용하고, `App.tsx`에는 view config wiring만 노출한다.
- [x] `App.tsx`는 세션 로딩, 탭 상태, 선택 이벤트 보정 effect, UI component 조립만 담당한다.

## 수용 기준

- `App.tsx`에서 직접 호출하던 `src/lib/logs/analysis.ts` 계산 함수 import가 사라진다.
- 이벤트/분석 탭의 기존 props와 사용자 동작은 바뀌지 않는다.
- 선택 이벤트가 필터 범위에서 사라질 때 기존처럼 선호 이벤트로 보정된다.
- `pnpm lint:js`, `pnpm test -- src/test/app.smoke.test.tsx`, `pnpm build`, `pnpm check`가 통과한다.

## 검증

- `pnpm lint:js`
- `pnpm test -- src/test/app.smoke.test.tsx`
- `pnpm build`
- `pnpm check`

## 진행 메모

- 2026-04-26: 파생 계산 분리는 반복 변경 비용을 낮추는 이득이 있다고 판단했다. `App.tsx`가 상태 hook 분리 뒤에도 분석 계산과 UI wiring을 함께 들고 있어, 다음 기능 배치 전에 view model hook으로 경계를 고정했다.
