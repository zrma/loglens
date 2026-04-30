# 완료 마일스톤

이 문서는 완료된 작업 단위의 짧은 이력입니다. 개별 작업 문서가 모두 닫힌 뒤 active backlog처럼 남지 않도록, 완료 요약과 검증 기준만 이곳에 보존합니다.

새 작업을 시작할 때는 `docs/status.md`와 `docs/roadmap.md`에서 현재 리스크와 후보를 확인하고, 필요한 경우에만 좁은 작업 문서를 새로 만듭니다. 닫힌 작업 문서는 이 문서에 요약을 옮긴 뒤 active 문서 목록에서 제거합니다.

## 2026-04-26 MVP 마일스톤

- Custom Alias Override UI: 세션 단위 alias override 상태, 필드 매핑 UI, 즉시 재파싱, summary badge, preset 우선순위 테스트를 추가했다.
- Parser Diagnostics 강화: `timestamp_missing`, `timestamp_parse_failed`, `json_parse_failed`, `structured_parse_fallback`, `key_value_partial_parse`, `alias_override_applied`, `correlation_field_missing` 중심으로 severity와 line/source/event metadata를 정리했다.
- Analysis Drill-down 연결: 분석 탭의 시간대, level, service, request, diagnostic 분포를 drill-down filter로 연결하고 chip 기반 개별/전체 해제를 추가했다.
- Cross-file Trace Diff: traceId, requestId, derived flow 기준 source별 event count, duration, issue count, span/service/route/method missing hint를 비교하게 했다.
- 대용량 세션 메모리 최적화: 이벤트 필터와 analysis drill-down을 한 predicate 경로로 합치고, top trace/derived-flow preview와 선택 이벤트 derived-flow 상세를 bounded/lazy 경로로 분리했다.

## 2026-04-26 신뢰성 및 유지보수

- 신뢰성 보강: 지원 timestamp 형식과 parse failure 규칙을 `docs/log-format-support.md`에 문서화하고, timestamp 변형, trace/span/request/derived-flow edge case, 선택 파일 필터 조합 UI smoke를 보강했다.
- 유지보수 GC: 미사용 템플릿 잔재와 문서 드리프트를 제거하고, `src/App.tsx`의 filter/view configuration/view model 책임을 hook으로 분리했다.
- 디자인 시스템 GC: raw `<button>`에 explicit type을 고정하고, 반복 누락을 `pnpm check:agent-gc`가 잡게 했다.
- 번들 예산: `pnpm check:bundle`로 JavaScript chunk 500 KiB 예산을 확인하는 gate를 추가했다.

## 2026-04-26 parser compatibility

- HTTP/B3 correlation: `X-Request-ID`, `X-B3-TraceId`, `X-B3-SpanId`, `X-B3-ParentSpanId` 계열 field를 JSON line, nested JSON, key=value에서 canonical field로 승격했다.
- AWS X-Ray correlation: `X-Amzn-Trace-Id` 계열 header의 `Root`와 `Parent`를 trace/span fallback으로 사용하게 했다.
- OpenTelemetry log field alias: `timeUnixNano`, `observedTimeUnixNano`, `severityText`, `severityNumber`, `body`, `resource.attributes.service.name`, request ID 계열 nested field를 canonical field 후보로 고정했다.

## 2026-04-30 parser compatibility

- OTLP attribute array normalization: `{ key, value }` 배열 형태의 `resource.attributes`와 `attributes`를 dotted structured field로 정규화해 service/request/trace/span canonical field 승격에 사용할 수 있게 했다.
- 원본 구조 단서: attribute 배열의 indexed field도 유지해 상세 이벤트 패널에서 원래 shape를 계속 확인할 수 있게 했다.

## 2026-04-28 session snapshot

- 분석 세션 snapshot: raw 로그 본문 없이 parser preset, session alias override, filter, analysis drill-down, event stream column, field visibility, active tab, source signature를 JSON으로 export/import하게 했다.
- 복원 경계: 같은 로그 세션에서는 분석 관점을 복원하고, source signature mismatch는 warning으로 표시한다. 자동 파일 재열기, 파일 접근 범위 확대, raw 로그 본문 저장은 범위에서 제외했다.

## 대용량 검증 기준

- 빠른 regression: `pnpm test:large-regression`은 3,000-event parser/runtime fixture를 기본 gate에 유지한다.
- 느린 benchmark: `pnpm bench:large-session`은 `LOG_LENS_LARGE_BENCH=1`로 opt-in 실행하며 200k-line benchmark candidate를 기본 테스트 경로 밖에 둔다.

## 현재 검증 명령

```bash
pnpm check
pnpm check:harness
pnpm check:agent-gc
pnpm check:runtime-smoke
pnpm test:large-regression
pnpm bench:large-session
```
