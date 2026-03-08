# 현재 상태

## 한 줄 요약

LogLens는 지금 `로컬 로그 파일 -> 구조화 이벤트 파싱 -> trace/span 관계 탐색 -> 기본 분석 차트`까지 가능한 데스크톱 로그 워크벤치 MVP 상태입니다.

## 지금까지 완료된 것

- Tauri 기반 데스크톱 셸과 Vite/React 프런트엔드 부트스트랩
- 선택한 `.log`/`.txt` 파일만 접근 허용하는 파일 열기 플로우
- 구조화 로그 파서
  - JSON line
  - key=value
  - plain text timestamp prefix 일부
  - multiline stack trace 병합
- 이벤트 도메인 모델 정리
  - `timestamp`
  - `level`
  - `service`
  - `message`
  - `traceId`
  - `spanId`
  - `parentSpanId`
  - `requestId`
- 탐색 UI
  - 검색어 필터
  - level/service/trace/request 필터
  - issue-only 토글
  - 이벤트 목록
  - 상세 이벤트 패널
  - parser notes 표시
  - raw block 표시
- 관계 추적 UI
  - trace group 요약
  - span topology 트리
  - span timeline
- 분석 UI
  - 시간대 분포 차트
  - level/service/request/parser note 분포
- 샘플 trace 세션 fixture
- 테스트
  - parser/analysis smoke test
  - jsdom 기반 App smoke test
- 번들 최적화
  - `AnalysisTab` lazy load 분리
  - 기존 chunk size warning 제거

## 현재 구현 수준

현재 제품 성격은:

- 단순 로그 뷰어보다는 강함
- Kibana급 완성형 분석 도구보다는 훨씬 초기
- “개발자 로컬 디버깅용 structured log explorer”로는 방향이 명확한 상태

즉, 지금은 “의도 검증이 끝난 MVP”에 가깝고, 다음부터는 기능 확장보다 `신뢰성`, `성능`, `관계 시각화 고도화`가 중요합니다.

## 지금 바로 되는 것

- 샘플 세션 로드 후 trace/span 흐름 탐색
- 실제 로그 파일 1개 열기
- 문제 이벤트만 골라 보기
- 특정 service/request/trace 기준으로 좁혀 보기
- multiline 오류를 하나의 이벤트로 읽기
- trace 내 span 부모/자식 관계 확인
- trace 내 span 상대 시간축 확인

## 아직 부족한 것

- 로그 포맷 지원 범위가 아직 좁음
  - nested JSON 정규화
  - 더 많은 timestamp 포맷
  - 언어별 stack trace 패턴 확대
- 파일 처리 규모가 작음
  - 전체 파일 메모리 로드
  - 가상 스크롤 없음
  - 다중 파일 세션 없음
- 시각화가 아직 기본형
  - span timeline은 있지만 gantt 수준 상호작용 없음
  - trace 간 비교 없음
- 테스트 범위가 아직 얕음
  - 실제 파일 열기 플로우 미검증
  - 필터 상호작용 시나리오 부족
  - 대용량 fixture 없음

## 현재 리스크

- 대용량 로그에서 렌더링/메모리 비용이 커질 수 있음
- 파서 heuristic이 강해서 예상 밖 포맷에서 필드 추출 정확도가 흔들릴 수 있음
- Tauri 실제 런타임 연동은 smoke test가 아니라 수동 확인 비중이 큼
- `src/App.css` 같은 템플릿 잔재가 아직 남아 있음

## 다음 우선순위

### 1. 대용량 파일 대응

- 이벤트 테이블 가상 스크롤
- 파일 스트리밍/청크 파싱
- 세션 크기 커질 때 필터/집계 비용 줄이기

### 2. 파서 신뢰성 강화

- 언어별 stack trace fixture 확대
- nested JSON 필드 정규화
- 파싱 실패 이유 분류 세분화
- correlation ID 규칙 확대

### 3. 관계 추적 고도화

- span timeline 상호작용 강화
- trace 비교 뷰
- request/correlation 중심 탐색 패널

### 4. 테스트 확장

- 실제 파일 열기 플로우 mock test
- 필터 조합 시나리오 test
- trace/span 집계 경계 케이스 test

## 지금 당장 하지 않아도 되는 것

- Rust 분석 엔진화
- SQLite/인덱싱
- 외부 로그 소스 import
- 팀 공유 기능

## 재시작할 때 보면 좋은 파일

- [`README.md`](../README.md)
- [`docs/repository-overview.md`](./repository-overview.md)
- [`docs/roadmap.md`](./roadmap.md)
- [`src/App.tsx`](../src/App.tsx)
- [`src/lib/logs/parser.ts`](../src/lib/logs/parser.ts)
- [`src/lib/logs/analysis.ts`](../src/lib/logs/analysis.ts)
- [`src/features/log-explorer/components/EventsTab.tsx`](../src/features/log-explorer/components/EventsTab.tsx)

## 검증 기준

현재 기본 검증 명령은 아래 셋입니다.

```bash
pnpm test
pnpm build
pnpm lint
```
