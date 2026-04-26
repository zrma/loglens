# App 상태 관리 분리 작업 목록

## 목표

`src/App.tsx`가 세션 로드, 필터 상태, 파생 계산, 화면 조립을 한 파일에서 모두 들고 있는 부담을 줄인다. 첫 단계는 제품 동작을 바꾸지 않고 검색/필터/drill-down 상태를 전용 hook으로 분리해, 이후 파생 계산 또는 view configuration 분리를 더 작게 진행할 수 있게 만드는 것이다.

## 구현 항목

- [x] 검색어, level/source/service/trace/request filter 상태를 `useLogExplorerFilters()`로 이동한다.
- [x] field facet filter와 selected facet key 상태를 `useLogExplorerFilters()`로 이동한다.
- [x] analysis drill-down filter 추가/삭제/초기화 상태를 `useLogExplorerFilters()`로 이동한다.
- [x] `App.tsx`에는 탭 전환이 필요한 field filter 래퍼만 남긴다.
- [x] event stream column, field visibility 같은 view configuration 상태를 `useLogExplorerViewConfig()`로 분리한다.
- [x] `App.tsx`의 파생 계산 묶음을 `useLogExplorerViewModel()`으로 분리한다.

## 수용 기준

- 필터와 drill-down 동작은 기존 UI smoke가 그대로 검증한다.
- `App.tsx`에서 필터 초기화, field facet, analysis drill-down setter 구현이 사라진다.
- 새 hook은 `src/features/log-explorer/hooks/` 아래에 둔다.
- `pnpm lint:js`, `pnpm test`, `pnpm build`, `pnpm check`가 통과한다.

## 작업 순서

1. 필터 상태와 필터 조작 callback을 hook으로 이동한다.
2. 기존 App smoke가 커버하는 검색/level/source/field facet/drill-down 흐름을 재검증한다.
3. 동작 변경 없이 문서와 유지보수 GC 체크리스트를 갱신한다.
4. 다음 배치에서 view configuration 또는 view model 분리의 이득을 다시 판단한다.

## 검증

- `pnpm lint:js`
- `pnpm test -- src/test/app.smoke.test.tsx`
- `pnpm build`
- `pnpm check`

## 진행 메모

- 2026-04-26: 필터와 analysis drill-down 상태를 `useLogExplorerFilters()`로 분리했다. 탭 전환과 연결된 field filter 적용만 App에서 감싸도록 유지했다.
- 2026-04-26: event stream column과 field visibility 상태를 `useLogExplorerViewConfig()`로 분리했다. App에는 세션/탭/선택 이벤트 조립과 파생 계산이 남아 있다.
- 2026-04-26: `useLogExplorerViewModel()`을 추가해 App에 남은 파생 계산을 옮겼다. App에는 세션/탭/선택 이벤트 조립과 사용자 동작 wiring만 남긴다.
