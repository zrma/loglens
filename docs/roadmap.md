# 로드맵

## 목표

LogLens의 목표는 단순 파일 뷰어가 아니라, 로컬에서 바로 실행 가능한 로그 분석 및 디버깅 워크벤치가 되는 것입니다.

- 로그를 빠르게 열고 검색한다.
- 여러 로그 이벤트 사이의 관계를 따라간다.
- 요청 흐름을 trace/span 관점에서 재구성한다.
- 장애 분석과 디버깅에 필요한 컨텍스트를 한 화면에서 탐색한다.

## 현재 기반

2026-03-08 기준 현재 구현은 다음 수준까지 와 있습니다.

- 다중 `.log`/`.txt` 파일 선택과 병합 세션
- 구조화 이벤트 파싱(JSON line / key=value / plain text 일부 + multiline stack trace 병합)
- 이벤트 상세 패널과 관련 trace 이벤트 묶음
- 검색어, level, service, trace, request, issue-only 기반 필터링
- structured field facet drill-down과 다중 조건 조합
- trace 내부 parent/child span topology 카드
- trace 상대 시간축 기반 span timeline 카드
- parser diagnostics와 line range 표시
- 파일 라인 스트리밍 파싱 경로
- 이벤트 스트림 windowed/virtualized 렌더링
- 일부 공통 타임스탬프 형식 기반 시간대 분포 차트
- 샘플 trace 세션 fixture와 parser smoke test
- jsdom 기반 App UI smoke test
- 선택 파일 단위 Tauri 파일 접근 허용
- JS audit 취약점 정리와 주요 의존성 최신화

## 바로 다음 할 일

### 1. 분석 UX 확장

- 시간대 차트 외에 주요 키워드 집계와 drill-down 상호작용을 추가한다.
- 현재 field facet의 포함/제외 조건을 차트와 연결하고 drill-down 상호작용을 강화한다.
- 검색 결과와 차트, facet이 서로 drill-down 되도록 연결한다.

### 2. 관계 추적 고도화

- trace/span ID, request ID, correlation ID를 우선 지원 대상으로 정한다.
- 동일 ID를 가진 로그를 타임라인으로 묶는다.
- 현재 span tree를 timeline/gantt 뷰로 확장한다.

### 3. 파서 확장

- JSON nested field와 다양한 timestamp 포맷을 더 안정적으로 처리한다.
- 파서 실패 라인에 대한 진단 이유를 더 세밀하게 저장한다.
- Java/Python/Node stack trace 패턴 fixture를 늘린다.

### 4. 다중 파일 correlation 고도화

- source별 정렬/클러스터링 전략을 더 안정적으로 만든다.
- 같은 trace/request가 여러 파일에 퍼져 있을 때 비교 뷰를 제공한다.
- source 전환과 trace drill-down이 서로 엮이도록 UI를 다듬는다.
- 현재 source coverage 카드를 trace diff 수준으로 확장한다.

### 5. 대용량 파일 대응

- 현재 라인 스트리밍 경로를 유지하면서 부분 집계/부분 렌더링을 더 공격적으로 줄인다.
- windowed list를 실제 대용량 fixture 기준으로 튜닝한다.
- 여러 파일을 세션 단위로 관리할 수 있게 한다.

### 6. 신뢰성

- 실제 파일 열기 플로우와 필터 상호작용 UI 테스트를 추가한다.
- trace 그룹화/집계 로직 테스트를 확장한다.
- 지원하는 타임스탬프 형식과 파싱 실패 규칙을 문서화한다.

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

- [`src/App.css`](../src/App.css) 정리 또는 삭제
- `src/App.tsx` 상태 관리 추가 분리 여부 재검토
- 디자인 시스템 컴포넌트 사용 범위 재점검
- 번들 split 이후 청크 크기와 lazy 경계 지속 점검
