# 로그 분석 계약

## 소유 경계

완료된 MVP와 source sequence 구현에서 유지할 의미와 제약을 정리한다. 구현·type의
source of truth는 `src/lib/logs/`, 화면과 파생 계산은 `src/features/log-explorer/`다.
지원 포맷은 `docs/log-format-support.md`, 검증된 결과는 `docs/completed-milestones.md`,
새 작업과 남은 성능·사용면 한계는 `docs/status.md`와 `docs/roadmap.md`가 소유한다.

## 파싱과 설명 가능성

- canonical timestamp/level/service/message/trace/span/parent-span/request field를 유지한다.
- 구조화 JSON·nested JSON·key=value의 alias는 user override, selected preset, built-in
  fallback 순서로 해석한다. override 적용·해제는 현재 세션을 다시 파싱한다.
- override는 세션 설정이며 독립적인 영구 preset 저장소나 범용 schema editor가 아니다.
  session snapshot에서 복원할 수 있는 상태와 외부 preset 관리 요구를 구분한다.
- diagnostics는 kind/severity와 source/event/line metadata로 결과를 설명한다.
  `timestamp_missing`과 `timestamp_parse_failed`를 구분하고 alias 적용과 correlation
  누락을 숨기지 않는다. 정확한 종류와 지원 범위는 구현과 포맷 문서가 소유한다.

alias 보정과 진단을 먼저 만든 이유는 뒤의 drill-down과 source 비교가 잘못된 상관관계를
확정된 사실처럼 보여주지 않도록 하기 위해서였다. 자동 수정·AI 포맷 추론은 이 계약의
일부가 아니다.

## 탐색과 source 비교

Analysis drill-down은 기존 검색·facet 조건과 별도 상태로 관리하되 최종 이벤트 필터에서
결합한다. 시간대/level/service/request/diagnostic 선택은 chip으로 보이고 탭 전환 뒤에도
유지한다. 개별 해제, 분석 조건만 해제, 전체 초기화를 구분한다.

Cross-file Trace Diff의 선택 기준은 `traceId -> requestId -> derived flow`다. 명시적
trace와 추론된 flow를 한 비교 근거로 섞지 않는다. source별 count·duration·issue와
span/service/route/method 누락 단서는 완전한 distributed trace 재구성을 주장하지 않는다.

Source Sequence는 같은 선택 기준으로 source별 읽기 전용 preview를 제공한다. 원본
source의 line order를 먼저 유지하고 같은 line에서만 timestamp를 보조 기준으로 쓴다.
source당 preview 수는 제한되지만 선택 범위 전체의 count와 truncation은 표시한다.
선택 source를 강조하고 event 클릭은 기존 이벤트 선택으로 연결한다. service와 HTTP
method/route badge를 함께 보여준다. 정확한 제한과 정렬은 `buildTraceSourceSequence`가
소유한다. bounded preview는 전체 선택 이벤트의 정렬·메모리 비용이 상수라는 뜻이 아니다.

## 메모리와 저장 한계

스트리밍 파싱 뒤에도 전체 이벤트는 메모리에 남는다. 필터와 drill-down을 한 predicate로
결합하고, top trace/flow preview·선택 상세·facet 계산을 bounded/lazy 경로로 줄인다.
windowed event list와 비활성 패널 계산 생략은 전체 session의 점진 저장을 대신하지 않는다.

3,000-event regression은 기본 gate, 200k-line benchmark는 opt-in 후보로 구분한다.
실제 Tauri 창 자동화나 브라우저/desktop render 성능 측정이 없는 상태에서 대규모 실사용
성능을 통과했다고 표시하지 않는다. session snapshot은 raw 로그 없는 parser/view/filter
상태와 source signature를 보존하며, 자동 파일 재열기나 파일 접근 범위 확대를 하지 않는다.

## 다시 판단할 조건

선택 이벤트 주변 window와 analysis tab 요약, cross-trace diff, timeline/gantt,
bookmark·annotation, desktop 검증은 각각 다음 slice 후보로 남는다. snapshot schema나
저장 데이터 범위 확대, 원본 line order를 timestamp 전역 정렬로 바꾸는 요구는 기존
재현·privacy 계약과 함께 먼저 판단한다. 구체적 목적·관계·완료 기준이 정해진 시점에
새 todo spec을 만들며 완료된 구현 순서를 active backlog로 유지하지 않는다.
