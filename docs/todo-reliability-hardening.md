# 신뢰성 보강 작업 목록

## 목표

LogLens의 현재 MVP 기능을 더 넓은 실제 로그 입력과 반복 작업 흐름에서 깨지지 않게 만든다. 우선은 parser 설명 가능성, trace/flow 집계 edge case, 실제 UI 필터 상호작용, 문서/하네스 freshness를 작은 회귀 테스트와 문서로 고정한다.

## 구현 항목

- [x] 지원 timestamp 형식과 parse failure 규칙을 문서화한다.
- [x] timestamp 변형과 parse failure 분류에 대한 parser test를 보강한다.
- [x] trace/span/request/derived-flow 집계 edge case test를 확장한다.
- [ ] 실제 파일 열기 후 검색/level/source/field facet 조합 UI smoke를 추가한다.
- [ ] 문서 freshness와 신뢰성 todo 링크를 하네스가 확인하게 한다.
- [ ] README, docs/status.md, docs/roadmap.md, docs/repository-overview.md에 구현 상태를 반영한다.

## 수용 기준

- 사용자는 현재 지원하는 timestamp 형식과 실패 시 Parser Diagnostics가 어떻게 분류되는지 문서에서 확인할 수 있다.
- parser test가 성공 케이스와 실패 케이스를 함께 고정한다.
- trace/flow 집계 테스트가 순서 뒤섞임, missing parent/span, request fallback 같은 edge를 명확히 검증한다.
- UI smoke가 실제 선택 파일 세션에서 복수 필터 조합을 agent-legible하게 검증한다.
- 신뢰성 관련 문서 링크와 상태가 `pnpm check:harness`에서 드리프트하지 않는다.
- `pnpm test`, `pnpm build`, `pnpm lint:js`, `pnpm check`가 통과한다.

## 작업 순서

1. timestamp 지원 범위 문서와 parser test를 먼저 추가한다.
2. trace/span/request/derived-flow 집계 edge test를 확장한다.
3. selected-file 기반 필터 조합 UI smoke를 추가한다.
4. 하네스가 신뢰성 todo와 문서 freshness를 확인하게 한다.
5. 상태 문서와 README를 실제 구현 상태에 맞춰 갱신한다.

## 검증

- `pnpm test -- src/lib/logs/parser.test.ts`
- `pnpm test -- src/test/runtime-harness.test.tsx src/test/app.smoke.test.tsx`
- `pnpm check:harness`
- `pnpm lint:js`
- `pnpm build`
- `pnpm check`

## 진행 메모

- 2026-04-26: 대용량 세션 메모리 최적화 todo를 닫은 뒤, 다음 마일스톤을 신뢰성 보강으로 정리했다.
- 2026-04-26: `docs/log-format-support.md`에 timestamp 후보/지원값/diagnostic 규칙을 문서화하고, parser test에 ISO/offset/slash/plain/numeric epoch timestamp 회귀 케이스를 추가했다.
- 2026-04-26: 시간 순서가 뒤섞인 trace와 parent span이 누락된 span forest edge case를 parser/analysis test에 추가했다.
