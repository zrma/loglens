# 로드맵

## 목표

LogLens의 목표는 단순 파일 뷰어가 아니라, 로컬에서 바로 실행 가능한 로그 분석 및 디버깅 워크벤치가 되는 것입니다.

- 로그를 빠르게 열고 검색한다.
- 여러 로그 이벤트 사이의 관계를 따라간다.
- 요청 흐름을 trace/span 관점에서 재구성한다.
- 장애 분석과 디버깅에 필요한 컨텍스트를 한 화면에서 탐색한다.

## 현재 기반

2026-04-26 기준 현재 구현은 다음 수준까지 와 있습니다.

- 다중 `.log`/`.txt` 파일 선택과 병합 세션
- 구조화 이벤트 파싱(JSON line / key=value / plain text 일부 + multiline stack trace 병합)
- 이벤트 상세 패널과 관련 trace 이벤트 묶음
- 검색어, level, service, trace, request, issue-only 기반 필터링
- structured field facet drill-down과 다중 조건 조합
- trace 내부 parent/child span topology 카드
- trace 상대 시간축 기반 span timeline 카드
- severity/kind 기반 parser diagnostics와 line range 표시
- 세션 단위 custom alias override UI
- 파일 라인 스트리밍 파싱 경로
- 이벤트 스트림 windowed/virtualized 렌더링
- 일부 공통 타임스탬프 형식 기반 시간대 분포 차트
- cross-file Trace Diff와 source별 missing hint
- 샘플 trace 세션 fixture와 parser smoke test
- jsdom 기반 App UI smoke test
- 선택 파일 단위 Tauri 파일 접근 허용
- JS audit 취약점 정리와 주요 의존성 최신화
- `pnpm check:harness` 기반 에이전트 운영 계약/문서 드리프트 검증
- `pnpm check:agent-gc` 기반 자율 실행 플레이북/품질 GC 검증

## 바로 다음 할 일

상세 구현 스펙은 [`docs/next-phase-spec.md`](./next-phase-spec.md)를 기준으로 진행합니다.

### 완료. Custom Alias Override UI

- 세션 단위 field alias override를 적용한다.
- preset 위에 사용자 매핑을 우선 적용하고 즉시 재파싱한다.
- canonical field와 실제 로그 키의 매핑을 UI에서 보정한다.

### 완료. Parser Diagnostics 강화

- 파서 실패 라인과 fallback 이유를 더 세밀하게 저장한다.
- timestamp 누락과 parse 실패를 구분한다.
- alias override로 해결 가능한 진단 힌트를 노출한다.
- 세션 요약, 이벤트 상세, 분석 탭에서 kind/severity 분포를 표시한다.

### 완료. 분석 UX 확장

- 시간대 차트 외에 주요 키워드 집계와 drill-down 상호작용을 추가한다.
- 현재 field facet의 포함/제외 조건을 차트와 연결하고 drill-down 상호작용을 강화한다.
- 검색 결과와 차트, facet이 서로 drill-down 되도록 연결한다.
- 분석 탭에서 만든 조건을 chip으로 표시하고 개별/전체 해제할 수 있게 한다.

### 완료. Cross-file Trace Diff

- 같은 trace/request가 여러 파일에 퍼져 있을 때 비교 뷰를 제공한다.
- source 전환과 trace drill-down이 서로 엮이도록 UI를 다듬는다.
- 현재 source coverage 카드를 trace diff 수준으로 확장한다.

### 완료. 대용량 파일 대응

- 현재 라인 스트리밍 경로를 유지하면서 부분 집계/부분 렌더링을 더 공격적으로 줄인다.
- windowed list를 실제 대용량 fixture 기준으로 튜닝한다.
- 여러 파일 세션의 대용량 파생 계산 비용을 줄인다.
- 빠른 large regression과 opt-in 200k-line benchmark 후보를 분리한다.

### 1. 신뢰성

작업 목록은 [`docs/todo-reliability-hardening.md`](./todo-reliability-hardening.md)를 기준으로 진행한다.

- 실제 파일 열기 플로우와 필터 상호작용 UI 테스트를 추가한다.
- 하네스 검증을 제품 경계와 문서 freshness까지 점진적으로 확장한다.
- 품질 GC 루프를 주기적으로 돌려 stale marker, 개인 경로 누출, 문서 드리프트를 작게 정리한다.
- trace 그룹화/집계 로직 테스트를 확장한다.
- 지원하는 타임스탬프 형식과 파싱 실패 규칙을 문서화한다.

### 2. 유지보수 GC

작업 목록은 [`docs/todo-maintenance-gc.md`](./todo-maintenance-gc.md)를 기준으로 진행한다.

- 완료된 마일스톤 뒤의 stale 문서 설명을 실제 상태에 맞춘다.
- 미사용 템플릿 파일과 불필요한 링크를 제거한다.
- `src/App.tsx` 필터와 view configuration 상태 분리는 [`docs/todo-app-state-split.md`](./todo-app-state-split.md) 기준으로 진행하고, 후속 view model 분리 여부를 재검토한다.
- 디자인 시스템 컴포넌트 사용 범위를 점검한다.
- 번들 lazy boundary는 `pnpm check:bundle`의 500 KiB JavaScript chunk budget으로 지속 확인한다.

## 중기 방향

- 다중 파일 correlation
- 저장된 분석 세션
- 북마크/메모/주석
- 특정 에러 패턴 탐지
- OpenTelemetry 스타일 trace 데이터와의 연결 가능성 검토

## 장기 방향

- 로컬 인덱싱
- 빠른 전문 검색
- 플러그인형 파서
- 외부 로그 소스 import
- 팀 공유용 export/report

## 유지보수 백로그

- [`docs/todo-maintenance-gc.md`](./todo-maintenance-gc.md)의 후속 항목 진행
- `src/App.tsx` 파생 계산 추가 분리 여부 재검토
- 디자인 시스템 컴포넌트 사용 범위 재점검
- `pnpm check:bundle` budget이 현재 chunk split을 충분히 잡는지 재점검
- 품질 GC 규칙이 실제 반복 부채를 충분히 잡는지 재점검
