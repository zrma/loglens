# OpenTelemetry log field alias 작업 목록

## 목표

OpenTelemetry/OTLP JSON 형태로 export된 로그 레코드에서 흔한 timestamp, severity, body, resource/service, trace/span field를 별도 설정 없이 canonical field로 읽는다. 완전한 OTLP import가 아니라, 이미 JSON line으로 떨어진 로그를 로컬 분석 세션에서 바로 탐색할 수 있게 만드는 parser alias milestone이다.

## 구현 항목

- [ ] `timeUnixNano`, `time_unix_nano`, `observedTimeUnixNano`, `observed_time_unix_nano`를 timestamp 후보로 인식한다.
- [ ] `severityText`, `severity_text`, `severityNumber`, `severity_number`를 level 후보로 인식한다.
- [ ] `body.stringValue`, `body`, `message` 계열을 message 후보로 인식한다.
- [ ] `resource.attributes.service.name`과 `resource.attributes.service_name`을 service 후보로 인식한다.
- [ ] `attributes.http.request_id`, `attributes.request_id`, `attributes.x-request-id`를 request ID 후보로 인식한다.
- [ ] parser 회귀 테스트로 OTLP-style nested JSON 입력을 고정한다.

## 비범위

- OTLP protobuf, JSON envelope 전체 import
- OpenTelemetry span/event model 재구성
- resource/scope/logRecords 배열 flattening 전용 importer
- arbitrary semantic convention editor

## 수용 기준

- OTLP-style JSON log line이 canonical `timestamp`, `level`, `service`, `message`, `traceId`, `spanId`, `requestId`로 추출된다.
- numeric epoch normalization을 재사용해 nanosecond timestamp가 millisecond timestamp로 정규화된다.
- 기존 alias preset과 session override 우선순위가 바뀌지 않는다.
- `pnpm test -- src/lib/logs/parser.test.ts`, `pnpm check:harness`, `pnpm check`가 통과한다.

## 진행 메모

- 2026-04-27: X-Ray correlation follow-up 뒤의 parser compatibility milestone으로 분리했다.
