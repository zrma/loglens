# Cross-file Trace Diff 작업 목록

## 목표

같은 trace 또는 derived flow가 여러 source에 걸쳐 있을 때 source별 진행 상태를 비교해, 어느 파일 또는 서비스 흐름에서 이벤트가 끊기거나 부족한지 빠르게 확인할 수 있게 한다.

## 구현 항목

- [ ] traceId가 있는 선택 이벤트에 대해 source별 diff row를 계산한다.
- [ ] traceId가 없는 선택 이벤트는 requestId 또는 derived flow 기준으로 diff row를 계산한다.
- [ ] source별 event count, first seen, last seen, duration, issue count를 표시한다.
- [ ] source별 service, span, route/method coverage를 비교한다.
- [ ] 현재 선택 이벤트가 속한 source를 강조한다.
- [ ] 다른 source에는 있는데 현재 source에는 없는 span/service/route를 missing hint로 표시한다.
- [ ] 기존 Source 커버리지 카드를 Trace Diff 카드로 확장하거나 대체한다.
- [ ] trace diff analysis 유틸 테스트를 추가한다.
- [ ] 다중 파일 세션 smoke test에 Trace Diff 표시를 추가한다.
- [ ] README, docs/status.md, docs/repository-overview.md, docs/next-phase-spec.md에 구현 상태를 반영한다.

## 수용 기준

- 다중 파일 세션에서 선택 trace의 source별 diff를 볼 수 있다.
- 명시적 trace가 없을 때 requestId 또는 derived flow 기준 비교가 작동한다.
- 사용자는 source별 시작/끝, duration, event/issue 수, service/span/route coverage를 한 카드에서 확인할 수 있다.
- 현재 선택 이벤트 source와 missing hint가 UI에서 명확히 구분된다.
- 관련 분석 유틸 테스트와 App smoke test가 통과한다.
- `pnpm test`, `pnpm build`, `pnpm lint:js`, `pnpm check`가 통과한다.

## 다음 마일스톤

이 작업이 완료되면 `docs/next-phase-spec.md`의 다섯 번째 항목인 대용량 세션 메모리 최적화로 넘어간다.

## 검증

- `pnpm test -- src/lib/logs/parser.test.ts src/test/app.smoke.test.tsx`
- `pnpm lint:js`
- `pnpm build`
- `pnpm check`
