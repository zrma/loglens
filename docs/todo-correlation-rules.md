# Correlation 규칙 확장 작업 목록

## 목표

명시적인 `traceId`, `spanId`, `requestId` 필드가 없는 실제 로그에서도 흔한 HTTP correlation header를 canonical field로 승격한다. Cross-file Trace Diff와 derived flow가 더 많은 로컬 로그에서 바로 연결되도록 만드는 첫 제품 마일스톤이다.

## 구현 항목

- [x] JSON line과 nested JSON에서 `X-Request-ID` 계열 request ID를 인식한다.
- [x] JSON line과 nested JSON에서 B3 header(`X-B3-TraceId`, `X-B3-SpanId`, `X-B3-ParentSpanId`)를 trace/span field로 인식한다.
- [x] key=value 로그에서 `x-request-id`, `x-b3-traceid`, `x-b3-spanid`, `x-b3-parentspanid`를 인식한다.
- [x] parser 회귀 테스트로 nested JSON과 key=value 입력을 함께 고정한다.

## 비범위

- AWS X-Ray `Root=...;Parent=...` 값 파싱
- arbitrary header schema editor
- OpenTelemetry span model import
- distributed trace 완전 재구성

## 수용 기준

- common HTTP/B3 correlation header가 canonical `traceId`, `spanId`, `parentSpanId`, `requestId`로 추출된다.
- 기존 alias preset과 session override 우선순위가 바뀌지 않는다.
- `pnpm test -- src/lib/logs/parser.test.ts`, `pnpm check:harness`, `pnpm check`가 통과한다.

## 진행 메모

- 2026-04-26: 첫 slice로 HTTP request ID와 B3 trace/span header alias를 추가했다. suffix lookup 덕분에 `headers.X-Request-ID`처럼 nested JSON 안에 있는 header도 canonical field로 승격된다.
