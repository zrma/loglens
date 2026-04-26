# 다음 단계 구현 스펙

## 목적

이 문서는 다음 구현 우선순위를 실제 작업 단위로 내린 스펙입니다.

현재 `docs/roadmap.md`와 `docs/status.md`에는 방향과 우선순위는 정리되어 있지만, 각 항목의 구체적인 UX, 상태 모델, 수용 기준은 충분히 내려와 있지 않습니다. 이 문서는 그 빈칸을 채우는 용도입니다.

## 구현 순서

1. custom alias override UI
2. parser diagnostics 강화
3. analysis drill-down 연결
4. cross-file trace diff
5. 대용량 세션 메모리 최적화

이 순서는 의도적으로 고정합니다. 1, 2가 먼저 안정되어야 3, 4의 상관관계 UX가 신뢰성을 가질 수 있고, 5는 앞선 기능을 실제 데이터 규모에서 버티게 만드는 단계입니다.

## 공통 원칙

- 내부 canonical field는 유지한다.
  - `timestamp`
  - `level`
  - `service`
  - `message`
  - `traceId`
  - `spanId`
  - `parentSpanId`
  - `requestId`
- 새 기능은 현재 `auto/default/zap-short-json` preset과 충돌하지 않아야 한다.
- 첫 단계에서는 세션 단위 설정만 지원한다.
- 첫 단계에서는 분석 정확도보다, 사용자가 왜 현재 결과가 나왔는지 이해할 수 있는 설명 가능성을 우선한다.

## 1. Custom Alias Override UI

상태: 2026-04-26 구현 완료. 구현 세부 작업 목록은 [`docs/todo-custom-alias-override.md`](./todo-custom-alias-override.md)에 남긴다.

### 목표

사용자가 세션 단위로 canonical field 매핑을 직접 보정할 수 있게 한다.

예:

- `T -> timestamp`
- `L -> level`
- `N -> service`
- `M -> message`
- `rid -> requestId`

### 문제

현재는 parser preset만 고를 수 있고, 특정 팀/서비스의 short key 또는 변형 필드명을 만나면 코드 수정 없이는 적응이 어렵다.

### 범위

- 세션 단위 override만 지원
- JSON line / nested JSON / key-value 구조화 필드에만 적용
- 우선 지원 canonical field:
  - `timestamp`
  - `level`
  - `service`
  - `message`
  - `traceId`
  - `spanId`
  - `parentSpanId`
  - `requestId`
- preset 위에 override를 덮어쓴다

### 비범위

- override 영구 저장
- 프로젝트별 preset 파일 import/export
- plain text regex 파서 커스터마이즈
- 임의의 모든 field를 canonical field로 승격하는 범용 schema editor

### UX

- 위치: 상단 `파서 프리셋` 카드 아래 또는 옆에 `필드 매핑` 진입점 추가
- 진입 방식: modal 또는 drawer
- 화면 요소:
  - 현재 preset 이름
  - canonical field 목록
  - 각 canonical field에 대한 alias 입력
  - 여러 alias를 comma-separated 또는 token 입력으로 허용
  - `preset 기준으로 되돌리기`
  - `현재 세션 다시 파싱`
- 상태 표시:
  - override가 적용된 필드는 badge로 표시
  - override 적용 후 세션 summary에 `custom alias active` 표시

### 상태 모델

```ts
type CanonicalFieldKey =
  | "timestamp"
  | "level"
  | "service"
  | "message"
  | "traceId"
  | "spanId"
  | "parentSpanId"
  | "requestId";

type AliasOverrideMap = Partial<Record<CanonicalFieldKey, string[]>>;
```

해결 순서:

1. user override
2. selected preset
3. built-in default fallback

### 수용 기준

- 사용자는 UI에서 `message=M`, `timestamp=T` 같은 override를 넣을 수 있다.
- override 적용 후 현재 세션이 즉시 다시 파싱된다.
- override를 지우면 preset 기준 결과로 되돌아간다.
- override 유무가 UI에 명확히 표시된다.
- `pnpm test`, `pnpm build`, `pnpm lint` 통과
- parser test에 preset + override 우선순위 케이스가 추가된다.

## 2. Parser Diagnostics 강화

상태: 2026-04-26 구현 완료. 구현 세부 작업 목록은 [`docs/todo-parser-diagnostics.md`](./todo-parser-diagnostics.md)에 남긴다.

### 목표

파서가 무엇을 성공했고 무엇을 놓쳤는지, 사용자가 원인을 추적할 수 있게 만든다.

### 문제

현재 parser note는 존재하지만, 왜 특정 필드가 인식되지 않았는지와 어떤 라인이 fallback 처리됐는지 설명력이 부족하다.

### 범위

- diagnostic kind 세분화
- severity 도입
- 세션 요약, 이벤트 상세, 분석 탭에서 진단을 보여줌
- alias override와 연결되는 진단 메시지 제공

### 비범위

- 라인 단위 전체 실패 리포트 export
- 자동 수정 제안 생성
- AI 기반 포맷 추론

### 제안 진단 종류

- `timestamp_missing`
- `timestamp_parse_failed`
- `structured_parse_fallback`
- `json_parse_failed`
- `key_value_partial_parse`
- `multiline_merged`
- `alias_override_applied`
- `correlation_field_missing`
- `field_collision`

### UX

- 세션 상단에 `Parser Diagnostics` 요약 카드 추가
- 분석 탭에 진단 분포 차트 추가
- 이벤트 상세 패널에서 현재 이벤트 관련 diagnostics를 상단 노출
- timestamp가 없을 때는 단순 경고 대신:
  - 어떤 key를 검사했는지
  - 어떤 포맷까지 시도했는지
  - override로 해결 가능한지
  를 짧게 설명

### 상태 모델

```ts
type ParserDiagnosticSeverity = "info" | "warning" | "error";

type ParserDiagnostic = {
  kind: string;
  severity: ParserDiagnosticSeverity;
  message: string;
  sourceId?: string;
  eventId?: string;
  lineStart?: number;
  lineEnd?: number;
  metadata?: Record<string, string | number | boolean>;
};
```

### 수용 기준

- timestamp 관련 실패는 단순 `missing` 하나가 아니라 `missing`과 `parse_failed`가 구분된다.
- alias override로 해결 가능한 경우 그 힌트가 diagnostic metadata 또는 문구로 드러난다.
- 분석 탭에서 진단 종류별 카운트를 볼 수 있다.
- parser test에 실패 종류 구분 케이스가 추가된다.

## 3. Analysis Drill-down 연결

상태: 2026-04-26 구현 완료. 구현 세부 작업 목록은 [`docs/todo-analysis-drill-down.md`](./todo-analysis-drill-down.md)에 남긴다.

### 목표

분석 탭의 차트와 요약 카드, facet, 이벤트 스트림을 서로 연결한다.

### 문제

지금은 차트가 “보기”에 가깝고, 실제 탐색 범위 조정은 sidebar facet이 맡고 있다. 사용자가 분석 탭에서 본 내용을 바로 이벤트 좁히기로 이어가기 어렵다.

### 범위

- 차트 클릭 시 필터 반영
- 카드 클릭 시 필터 반영
- active drill-down chip 표시
- drill-down 해제 및 초기화

### 비범위

- 복수 차트 동시 brushing
- 저장 가능한 분석 세션
- 고급 query language

### 대상 상호작용

- 시간대 차트 막대 클릭 -> 시간 bucket 필터
- level 분포 클릭 -> level filter 반영
- service 분포 클릭 -> service filter 반영
- request 분포 클릭 -> request filter 반영
- parser diagnostics 분포 클릭 -> diagnostics filter 반영

### UX

- 분석 탭 상단에 `현재 분석 범위` chip 영역 추가
- 차트 hover 시 `클릭해 범위 좁히기` affordance 제공
- 이벤트 탭으로 돌아가도 필터 상태 유지
- `분석에서 만든 조건만 해제`와 `모든 조건 초기화`를 구분

### 상태 모델

```ts
type DrillDownFilter =
  | { kind: "hourBucket"; value: string }
  | { kind: "level"; value: string }
  | { kind: "service"; value: string }
  | { kind: "request"; value: string }
  | { kind: "diagnostic"; value: string };
```

기존 필터 상태와 별도로 관리하되, 최종 이벤트 필터 단계에서 합쳐진다.

### 수용 기준

- 분석 탭에서 bar/card 클릭만으로 이벤트 범위를 줄일 수 있다.
- 이벤트 탭과 분석 탭 사이에서 drill-down 상태가 유지된다.
- 사용자는 현재 어떤 분석 조건이 걸려 있는지 chip으로 볼 수 있다.
- drill-down 제거가 개별/전체 모두 가능하다.

## 4. Cross-file Trace Diff

상태: 2026-04-26 구현 완료. 구현 세부 작업 목록은 [`docs/todo-cross-file-trace-diff.md`](./todo-cross-file-trace-diff.md)에 남긴다.

### 목표

같은 trace 또는 derived flow가 여러 source에 걸쳐 있을 때, 어느 source에서 이벤트가 부족하거나 끊기는지 비교할 수 있게 만든다.

### 문제

현재는 source coverage가 “어느 파일에 퍼져 있는가” 수준에 머무른다. 실제 디버깅에서는 “어느 서비스까지 왔고 어디서 끊겼는가”가 더 중요하다.

### 범위

- 선택된 trace 기준 source별 비교 카드
- trace가 없을 때는 derived flow 기준 비교 fallback
- source별 event count / first seen / last seen / duration / error count 비교
- missing span or missing source 힌트

### 비범위

- 완전한 distributed trace 재구성
- cross-trace diff
- span level gantt merge

### UX

- 위치: 이벤트 상세 패널 하단 또는 별도 `Trace Diff` 카드
- 표시 항목:
  - source 이름
  - 해당 trace/flow 이벤트 수
  - 시작/끝 시각
  - 상대 duration
  - error/fatal count
  - 핵심 span/route 존재 여부
- 강조:
  - 선택 이벤트가 속한 source 강조
  - 다른 source에는 있는데 현재 source에는 없는 span/resource가 있으면 경고 badge

### 파생 비교 규칙

- 우선순위:
  1. explicit traceId
  2. requestId
  3. derived flow key
- diff는 “명시적 trace”와 “추론된 flow”를 섞지 않는다.
- 명시적 trace가 없을 때만 derived flow 비교를 사용한다.

### 수용 기준

- 다중 파일 세션에서 선택 trace의 source별 비교가 가능하다.
- source coverage보다 한 단계 더 구체적인 `어디까지 왔는가 / 어디서 비었는가`를 보여준다.
- trace가 없는 REST 흐름에서도 derived flow 기준 비교가 작동한다.
- 관련 분석 유틸 테스트가 추가된다.

## 5. 대용량 세션 메모리 최적화

상태: 2026-04-26 계획 수립. 구현 세부 작업 목록은 [`docs/todo-large-session-memory-optimization.md`](./todo-large-session-memory-optimization.md)에 남긴다.

### 목표

현재 스트리밍 파싱 이후에도 남아 있는 전체 메모리 점유와 파생 계산 비용을 줄여, 실제 큰 세션에서 인터랙션을 유지한다.

### 문제

현재는:

- 전체 이벤트 배열 유지
- 전체 집계 재계산
- trace/span/facet 파생 계산 다수 유지

구조라서 파일이 커질수록 메모리와 CPU 비용이 빠르게 증가한다.

### 범위

- 대용량 fixture 추가
- 파생 계산 캐시/지연 계산
- 이벤트 필드 사본 최소화
- analysis용 집계의 incremental 또는 cached 경로 도입
- 큰 세션에서 비필수 패널 lazy 계산

### 비범위

- SQLite 저장소
- 디스크 기반 인덱싱
- Rust 분석 엔진 이관

### 성능 목표

1차 목표:

- 200k 라인 단일 파일 또는 3개 파일 병합 세션에서 앱이 죽지 않고 열린다.
- 이벤트 스크롤은 현재처럼 windowed list를 유지한다.
- 기본 검색/필터 반응은 “수 초 멈춤” 수준이 아니라, 체감상 계속 사용 가능한 수준을 유지한다.

정량 목표는 첫 large fixture 도입 후 측정해서 조정한다.

### 구현 방향

- `events` 원본과 필터 결과 외의 중복 배열 생성을 줄인다.
- traceGroups, spanForest, facetCounts 같은 파생 계산은 선택 trace/선택 facet 범위에서만 계산한다.
- 상세 패널이 닫혀 있거나 선택 이벤트가 없으면 관련 계산을 건너뛴다.
- large fixture 전용 smoke benchmark를 추가한다.

### 수용 기준

- large fixture 기준으로 `pnpm test` 안에 최소 smoke benchmark 또는 bounded regression test가 추가된다.
- 메모리 최적화 전후 기준을 문서화한다.
- 기존 UX를 깨지 않고 대용량 세션에서 입력/스크롤 체감이 나빠지지 않는다.

## 구현 메모

- 1, 2는 같은 배치로 묶어도 된다.
- 3은 2의 diagnostics 세분화가 먼저 있어야 UX가 깔끔하다.
- 4는 2, 3 이후에 붙이는 것이 가장 자연스럽다.
- 5는 독립 작업이 아니라, 3과 4를 붙이기 전에 한 번 점검하는 중간 품질 배치로 보는 것이 맞다.

## 문서 반영 규칙

이 스펙 문서를 기준으로 구현을 진행할 때는:

- 상태 변화가 있으면 `docs/status.md`에 현재 수준을 갱신
- 우선순위가 바뀌면 `docs/roadmap.md`를 갱신
- 사용자-facing 기능이 추가되면 `README.md`에도 반영
