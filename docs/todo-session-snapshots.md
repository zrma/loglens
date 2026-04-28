# 분석 세션 snapshot 작업 목록

## 목표

현재 로드된 로그 세션에서 만든 분석 관점을 로컬 JSON snapshot으로 내보내고, 같은 로그 세션을 다시 연 뒤 그 관점을 복원할 수 있게 한다. 첫 단계는 raw 로그 본문을 저장하지 않고 parser/view/filter 상태만 보존해, 파일 접근 범위와 개인정보 노출면을 넓히지 않는 것이다.

## 범위

- parser preset과 세션 alias override를 snapshot에 포함한다.
- 검색어, level/source/service/trace/request 필터, issue-only, structured field include/exclude 조건, analysis drill-down 조건을 snapshot에 포함한다.
- event stream column 설정과 field visibility 설정을 snapshot에 포함한다.
- active tab과 선택 이벤트 hint를 snapshot에 포함한다.
- source label, event count, time range 같은 source signature를 저장해 다른 세션에 적용할 때 사용자가 mismatch를 볼 수 있게 한다.

## 비범위

- raw 로그 라인 또는 전체 parsed event 저장
- 자동 파일 재열기 또는 filesystem access scope 확대
- 영구 preset 저장소, cloud sync, team 공유 기능
- indexed search나 SQLite 기반 세션 저장

## 구현 항목

- [x] snapshot JSON schema와 validator를 `src/features/log-explorer/`에 추가한다.
- [x] 현재 session/filter/view state에서 snapshot을 만들고 안전하게 복원하는 helper test를 추가한다.
- [x] overview 영역에 snapshot export/import 컨트롤과 mismatch 상태 메시지를 추가한다.
- [x] sample session smoke test로 export/import 후 필터와 view state가 복원되는지 검증한다.
- [x] README, docs/status.md, docs/roadmap.md, docs/repository-overview.md에 지원 범위와 한계를 반영한다.

## 수용 기준

- 사용자는 현재 분석 관점을 JSON 파일로 내보낼 수 있다.
- 사용자는 같은 세션을 다시 연 뒤 snapshot을 불러와 필터, drill-down, column/field visibility, parser alias 상태를 복원할 수 있다.
- snapshot import는 raw 로그를 읽거나 파일 접근 권한을 추가하지 않는다.
- source signature가 현재 세션과 다르면 UI에 경고를 표시하되, 사용자가 상태 적용 여부를 이해할 수 있다.
- 깨졌거나 버전이 맞지 않는 snapshot은 앱을 망가뜨리지 않고 오류 메시지로 거절된다.
- `pnpm test`, `pnpm build`, `pnpm check`가 통과한다.

## 작업 순서

1. 문서에 다음 마일스톤과 비범위를 고정한다.
2. schema/validator/export/import helper를 추가하고 단위 테스트로 고정한다.
3. UI에 export/import 컨트롤을 붙이고 sample session smoke를 추가한다.
4. 상태 문서와 README를 실제 구현 상태에 맞춰 갱신한다.

## 검증

- `pnpm test -- src/features/log-explorer/session-snapshot.test.ts`
- `pnpm test -- src/test/app.smoke.test.tsx`
- `pnpm lint:js`
- `pnpm build`
- `pnpm check`

## 진행 메모

- 2026-04-28: 기존 reliability, maintenance, correlation, OpenTelemetry todo가 모두 닫힌 상태라 다음 중기 마일스톤을 로컬 분석 세션 snapshot으로 분리했다.
- 2026-04-28: `session-snapshot.ts`에 schema/validator/export/import helper와 source signature compatibility check를 추가하고, helper 단위 테스트로 round-trip, invalid snapshot reject, mismatch warning을 고정했다.
- 2026-04-28: Overview에 snapshot Export/Import 컨트롤을 추가하고, parser/view/filter 상태 복원과 Tauri file scope 비확장을 App smoke test로 고정했다. README와 상태 문서는 raw 로그 없는 snapshot 한계를 명시하도록 갱신했다.
