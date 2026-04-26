# 유지보수 GC 작업 목록

## 목표

완료된 MVP 마일스톤 뒤에 남은 템플릿 잔재, 문서 드리프트, 구조 재점검 항목을 작은 단위로 정리한다. 기능 확장보다 현재 코드와 문서가 실제 상태를 정확히 말하게 만들고, 다음 구현 배치가 불필요한 노이즈 없이 시작되게 하는 것이 우선이다.

## 구현 항목

- [x] 현재 엔트리포인트에서 import하지 않는 `src/App.css` 템플릿 잔재를 삭제한다.
- [x] README, docs/status.md, docs/roadmap.md, docs/repository-overview.md에서 `src/App.css` 관련 stale 설명을 제거한다.
- [x] README의 "아직 구현되지 않은 부분"을 현재 대용량 최적화 상태에 맞춰 다시 쓴다.
- [x] `src/App.tsx` 필터 상태를 전용 hook으로 분리한다. 세부 범위는 [`docs/todo-app-state-split.md`](./todo-app-state-split.md)에 둔다.
- [x] `src/App.tsx` view configuration 상태를 전용 hook으로 분리한다.
- [ ] `src/App.tsx` 파생 계산의 추가 분리 여부를 실제 반복 변경 비용 기준으로 재검토한다.
- [ ] 디자인 시스템 컴포넌트 사용 범위를 한 번 훑고, 손쉬운 불일치만 정리한다.
- [x] 번들 split 이후 청크 크기와 lazy boundary를 500 KiB JavaScript chunk budget으로 검증한다.
- [ ] 품질 GC 규칙이 반복 부채를 충분히 잡는지 재점검하고, 기계적으로 잡을 수 있는 항목만 하네스에 추가한다.

## 수용 기준

- 불필요한 템플릿 파일이나 이를 가리키는 문서 링크가 남아 있지 않다.
- 현재 구현된 대용량 최적화와 아직 남은 한계가 README와 상태 문서에서 구분된다.
- 남은 유지보수 항목은 이 문서나 roadmap에서 추적 가능하다.
- docs-only가 아닌 파일 제거이므로 `pnpm check:harness`, `pnpm check:agent-gc`, `pnpm build`, `pnpm check`가 통과한다.

## 작업 순서

1. 템플릿 스타일 잔재와 문서 드리프트를 먼저 정리한다.
2. 검증이 끝난 뒤 이 변경 단위를 별도 commit/push로 닫는다.
3. 다음 배치에서 `src/App.tsx` 상태 관리 분리의 실제 이득과 위험을 코드 기준으로 재평가한다.

## 검증

- `pnpm check:harness`
- `pnpm check:agent-gc`
- `pnpm build`
- `pnpm check`

## 진행 메모

- 2026-04-26: next-phase와 신뢰성 보강 todo가 모두 완료된 상태를 확인하고, 후속 작업을 유지보수 GC로 전환했다.
- 2026-04-26: 검색/필터/drill-down 상태를 `useLogExplorerFilters()`로 분리하고, 남은 App 분리 후보를 view configuration과 view model로 좁혔다.
- 2026-04-26: event stream column과 field visibility 상태를 `useLogExplorerViewConfig()`로 분리했다.
- 2026-04-26: `pnpm check:bundle`을 추가해 build 산출물의 JavaScript chunk가 500 KiB 예산을 넘지 않는지 확인하게 했다.
