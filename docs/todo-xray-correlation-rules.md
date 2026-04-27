# AWS X-Ray correlation 규칙 작업 목록

## 목표

AWS ALB, API Gateway, Lambda, 서비스 로그에서 흔히 보이는 `X-Amzn-Trace-Id` 값을 canonical `traceId`와 `spanId`로 승격한다. HTTP/B3 header alias 다음 단계로, AWS 기반 다중 파일 세션에서 Trace Diff와 span 탐색이 바로 이어지게 만든다.

## 구현 항목

- [x] JSON line과 nested JSON에서 `X-Amzn-Trace-Id` 계열 header field를 인식한다.
- [x] key=value 로그에서 `x-amzn-trace-id`와 `x-amzn-traceid` field를 인식한다.
- [x] `Root=...;Parent=...;Sampled=...` 값에서 `Root`를 `traceId`, `Parent`를 `spanId`로 추출한다.
- [x] 기존 `traceId` 또는 `spanId`가 명시되어 있으면 그 값을 우선하고, X-Ray header는 fallback으로만 사용한다.
- [x] parser 회귀 테스트로 nested JSON과 key=value 입력을 함께 고정한다.

## 비범위

- `Sampled`, `Self`, `Lineage` 같은 X-Ray 부가 속성을 별도 canonical field로 승격
- X-Ray trace ID를 W3C trace ID로 변환하거나 정규화
- OpenTelemetry span model import
- distributed trace 완전 재구성

## 수용 기준

- X-Ray trace header가 canonical `traceId`와 `spanId`로 추출된다.
- 명시적인 trace/span field와 session alias override 우선순위가 바뀌지 않는다.
- 지원 범위와 남은 한계가 README, status, repository overview에서 현재 상태와 맞는다.
- `pnpm test -- src/lib/logs/parser.test.ts`, `pnpm check:harness`, `pnpm check`가 통과한다.

## 진행 메모

- 2026-04-27: HTTP/B3 correlation header milestone 다음 작업으로 분리했다.
- 2026-04-27: X-Ray header alias와 `Root`/`Parent` fallback parser를 추가하고, nested JSON/key=value 회귀 테스트로 고정했다.
