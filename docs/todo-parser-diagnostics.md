# Parser Diagnostics 강화 작업 목록

## 목표

파서가 어떤 입력을 성공적으로 구조화했고, 어떤 입력을 fallback 또는 제한된 해석으로 처리했는지 사용자가 추적할 수 있게 한다. 특히 timestamp, JSON, key=value, alias override 관련 원인을 세분화해 이벤트 상세와 분석 탭에서 같은 diagnostic 모델로 확인한다.

## 구현 항목

- [x] parser diagnostic kind를 `timestamp_missing`, `timestamp_parse_failed`, `structured_parse_fallback`, `json_parse_failed`, `key_value_partial_parse`, `multiline_merged`, `alias_override_applied`, `correlation_field_missing`, `field_collision` 중심으로 세분화한다.
- [x] diagnostic severity(`info`, `warning`, `error`)와 line/source/event metadata를 타입에 반영한다.
- [x] timestamp 후보가 없을 때와 후보 파싱 실패를 구분한다.
- [x] JSON으로 보이는 입력이 실패한 뒤 다른 포맷으로 fallback 되는 경로를 diagnostic으로 남긴다.
- [x] key=value partial parse나 structured fallback 상황을 사용자가 이해할 수 있는 문구로 남긴다.
- [x] alias override가 canonical field 추출에 쓰인 경우 diagnostic으로 노출한다.
- [x] trace/span/request 같은 correlation field가 없을 때 탐색 한계와 override 힌트를 남긴다.
- [x] 세션 요약에서 diagnostic severity/kind 분포를 볼 수 있게 한다.
- [x] 이벤트 상세 상단에서 선택 이벤트 관련 diagnostics를 표시한다.
- [x] 분석 탭에서 diagnostic kind별 분포를 확인할 수 있게 한다.
- [x] parser test에 timestamp missing/parse failed 구분, JSON fallback, alias override diagnostic 케이스를 추가한다.
- [x] App smoke test에 세분화된 parser diagnostics 노출 흐름을 추가한다.

## 수용 기준

- timestamp 관련 실패가 missing과 parse failed로 분리된다.
- alias override로 해결 가능하거나 실제 override가 적용된 경우 힌트가 diagnostic metadata 또는 문구로 드러난다.
- 분석 탭에서 diagnostic 종류별 카운트를 볼 수 있다.
- 이벤트 상세 패널에서 선택 이벤트 관련 diagnostic message를 확인할 수 있다.
- `pnpm test`, `pnpm build`, `pnpm lint:js`, `pnpm check`가 통과한다.

## 다음 마일스톤

이 작업이 완료되면 `docs/next-phase-spec.md`의 세 번째 항목인 Analysis Drill-down 연결로 넘어간다.

## 검증

- `pnpm test -- src/lib/logs/parser.test.ts src/test/app.smoke.test.tsx`
- `pnpm lint:js`
- `pnpm build`
- `pnpm check`
