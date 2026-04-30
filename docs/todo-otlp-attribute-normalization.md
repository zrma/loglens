# OTLP attribute normalization

## 배경

현재 parser는 OpenTelemetry-style 로그의 대표 필드(`timeUnixNano`, `severityText`, `body`, `resource.attributes.service.name`, `attributes.http.request_id`)를 canonical field로 승격한다. 다만 실제 OTLP JSON export에서는 `resource.attributes`와 `attributes`가 객체가 아니라 `{ key, value }` 배열 형태로 나타나는 경우가 흔하다. 이 경우 지금 flatten 결과가 `attributes.0.key`, `attributes.0.value.stringValue`처럼 남아서 service/request/message 승격이 제한된다.

## 목표

OTLP attribute 배열을 기존 `LogFieldMap` 안에서 dotted field처럼 사용할 수 있게 정규화한다. 첫 slice는 raw 로그 본문 저장, 파일 접근 범위, session snapshot 경계를 바꾸지 않고 parser compatibility만 넓힌다.

## 구현 순서

1. Parser planning
   - 이 문서로 다음 milestone 범위와 수용 기준을 고정한다.
   - `docs/status.md`와 `docs/roadmap.md`에서 active 작업 문서가 보이게 한다.
   - 검증: `pnpm check:harness`, `pnpm check:agent-gc`

2. OTLP attribute array flattening
   - `{ key: "service.name", value: { stringValue: "api" } }` 같은 배열 항목을 `service.name=api`처럼 읽을 수 있게 한다.
   - `stringValue`, `intValue`, `doubleValue`, `boolValue`, `bytesValue`, `arrayValue.values`, `kvlistValue.values`를 필요한 만큼 문자열 field로 보존한다.
   - 기존 indexed field(`attributes.0.key`)는 유지해 상세 패널에서 원본 구조 단서를 잃지 않는다.
   - parser test에 resource/service, request ID, trace/span, message body 변형을 추가한다.
   - 검증: `pnpm test -- src/lib/logs/parser.test.ts`

3. 문서와 milestone closure
   - 지원 범위를 `docs/log-format-support.md`, `docs/status.md`, `docs/completed-milestones.md`에 반영한다.
   - active 작업 문서를 닫을 때는 완료 요약만 milestone 문서로 옮기고 이 문서는 제거한다.
   - 검증: `pnpm check`

## 수용 기준

- OTLP attribute 배열 기반 service/request/message field가 alias override 없이 canonical field로 승격된다.
- 기존 객체 기반 nested JSON, zap short JSON, HTTP/B3, AWS X-Ray, session alias override 테스트가 유지된다.
- raw 로그 본문 없는 session snapshot 경계와 Tauri selected-file access scope를 바꾸지 않는다.
- parser compatibility 변경은 focused parser test와 full `pnpm check`를 통과한다.

## 에스컬레이션 조건

- OTLP semantic convention 중 어떤 field를 canonical로 볼지 제품 판단이 필요한 경우
- raw 로그 본문 저장, 영구 preset 저장소, 파일 재열기처럼 현재 scope를 넓혀야 하는 경우
- parser 정규화가 기존 structured field facet key를 대규모로 바꿔 UI 호환성 판단이 필요한 경우
