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
- HTTP/B3/AWS X-Ray correlation header 기반 trace/span/request 승격
- severity/kind 기반 parser diagnostics와 line range 표시
- 세션 단위 custom alias override UI
- raw 로그 본문 없는 로컬 분석 session snapshot export/import
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

## 최근 완료한 마일스톤

완료된 MVP 구현 배치의 상세 스펙은 [`docs/next-phase-spec.md`](./next-phase-spec.md)에 남아 있고, 닫힌 작업 단위의 요약과 검증 기준은 [`docs/completed-milestones.md`](./completed-milestones.md)에 둡니다.

- Custom Alias Override UI
- Parser Diagnostics 강화
- Analysis Drill-down 연결
- Cross-file Trace Diff
- 대용량 세션 메모리 최적화
- 신뢰성 보강과 지원 timestamp 문서화
- 유지보수 GC와 `App.tsx` filter/view configuration/view model 분리
- HTTP/B3, AWS X-Ray, OpenTelemetry parser compatibility
- raw 로그 본문 없는 로컬 분석 session snapshot

## 다음 후보

새 구현을 시작할 때는 아래 후보 중 하나를 작은 slice로 좁히고, 작업 중 추적 문서가 필요할 때만 새 작업 문서를 만듭니다. 닫힌 작업 이력은 `docs/completed-milestones.md`에 요약합니다.

- 다양한 로그 포맷과 nested JSON 정규화 확대
- trace 간 비교와 source diff를 더 깊게 지원하는 세션 관리
- span timeline/gantt 수준의 더 정교한 시각화
- 디스크 기반 인덱싱이나 SQLite 같은 장기 대용량 저장 경로
- raw 로그 본문 없이도 bookmark, annotation 같은 분석 보조 상태를 저장하는 UX
- 실제 Tauri 데스크톱 창 자동화와 브라우저/데스크톱 렌더링 성능 측정

## 중기 방향

- 다중 파일 correlation은 HTTP/B3와 AWS X-Ray 첫 slice가 완료된 상태에서, 다음에는 더 풍부한 연결 규칙과 trace 간 비교로 확장한다.
- 저장된 분석 세션은 raw 로그 없는 JSON snapshot 첫 slice가 완료된 상태에서, 다음에는 bookmark/annotation 같은 분석 보조 상태로 확장한다.
- 북마크/메모/주석
- 특정 에러 패턴 탐지
- OpenTelemetry 스타일 로그 field alias는 첫 slice가 완료된 상태에서, 다음에는 더 넓은 OTLP 변형과 nested attributes 정규화로 확장한다.

## 장기 방향

- 로컬 인덱싱
- 빠른 전문 검색
- 플러그인형 파서
- 외부 로그 소스 import
- 팀 공유용 export/report

## 유지보수 백로그

- `src/App.tsx` 파생 view model 분리 이후 반복 변경 비용 재점검
- 디자인 시스템 컴포넌트 사용 범위 재점검 완료 후 반복 drift만 추적
- session snapshot이 raw 로그 없는 상태 복원 경계를 계속 지키는지 재점검
- `pnpm check:bundle` budget이 현재 chunk split을 충분히 잡는지 재점검
- 품질 GC 규칙은 `pnpm check:agent-gc` 기준으로 반복 drift를 지속 점검
