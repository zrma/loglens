# 로그 포맷 지원 범위

## 목적

이 문서는 현재 LogLens parser가 안정적으로 읽는 timestamp와 diagnostic 규칙을 명시한다. 새 포맷을 추가할 때는 이 문서와 `src/lib/logs/parser.test.ts`를 함께 갱신한다.

## Timestamp 후보 선택

parser는 아래 순서로 timestamp 후보를 찾는다.

1. 선택된 alias preset과 세션 alias override의 timestamp field
   - 기본 후보: `timestamp`, `@timestamp`, `time`, `ts`, `datetime`, `event.time`, `log.timestamp`
   - `zap-short-json` 또는 auto-detected zap short JSON 후보: `T`
2. JSON object나 nested JSON을 flatten한 field
3. key=value field
4. plain text header의 `yyyy-mm-dd HH:mm:ss` 또는 `yyyy-mm-ddTHH:mm:ss` 계열 prefix

세션 alias override가 있으면 preset보다 먼저 적용된다.

## Structured field 정규화

JSON line은 nested object를 dotted field로 flatten한다. 예를 들어 `resource.attributes.service.name`은 같은 이름의 structured field로 보존되고, canonical alias lookup에서도 사용할 수 있다.

OpenTelemetry-style attribute 배열도 같은 field map으로 정규화한다.

- `resource.attributes: [{ key: "service.name", value: { stringValue: "api" } }]`
  - `resource.attributes.service.name=api`
  - 기존 indexed field인 `resource.attributes.0.key`, `resource.attributes.0.value.stringValue`도 함께 유지한다.
- `attributes: [{ key: "http.request_id", value: { stringValue: "req-1" } }]`
  - `attributes.http.request_id=req-1`
- OTLP value는 `stringValue`, `intValue`, `doubleValue`, `boolValue`, `bytesValue`, `arrayValue.values`, `kvlistValue.values`를 문자열 field로 보존한다.

## 지원 timestamp 값

현재 지원 범위는 JavaScript `Date.parse`와 numeric epoch normalization을 기준으로 한다.

- ISO/RFC3339 계열
  - `2026-03-08T12:34:56.000Z`
  - `2026-03-08T12:34:56+09:00`
  - `2026-03-04T22:46:55.704+0900`
- 공백 구분 또는 slash date 계열
  - `2026-03-08 12:34:56`
  - `2026/03/08 12:34:56`
- plain text prefix
  - `2026-03-08 12:34:56 INFO api message="..."`
  - `[2026-03-08 12:34:56] ERROR service ...`
- numeric epoch
  - seconds: `1741437296`
  - milliseconds: `1741437296000`
  - microseconds: `1741437296000123`
  - nanoseconds: `1741437296000123456`

공백 구분 또는 timezone 없는 값은 JavaScript runtime의 local-time parsing 규칙을 따른다. 정확한 UTC 기준이 필요한 로그는 `Z` 또는 explicit offset을 포함하는 ISO/RFC3339 값을 쓰는 것이 가장 안정적이다.

## Diagnostic 규칙

- `timestamp_missing`
  - timestamp 후보 field와 plain prefix를 모두 찾지 못한 경우
  - severity: `warning`
  - metadata에는 대표 checked key와 alias override hint를 포함한다.
- `timestamp_parse_failed`
  - timestamp 후보는 찾았지만 지원 범위로 파싱하지 못한 경우
  - severity: `warning`
  - metadata에는 실패한 key와 원본 value를 포함한다.
- timestamp 후보가 unparseable인 경우에는 `timestamp_missing`을 함께 붙이지 않는다.

## 현재 비범위

- timezone abbreviation: `PST`, `KST` 같은 약어
- locale-specific date: `03/08/2026 12:34:56`
- natural language timestamp
- leap second의 strict validation
- parser preset으로 date format string을 직접 지정하는 기능
