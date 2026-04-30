# Next product milestone decision

## 배경

OTLP attribute 배열 정규화까지 완료되면서 현재 active parser compatibility slice는 닫혔다. 다음 후보는 모두 구현 자체보다 제품 방향 선택이 먼저 필요한 영역이다. 이 문서는 다음에 어떤 milestone을 먼저 열지 결정하기 위한 짧은 gate다.

## 현재 후보

1. Trace comparison depth
   - 현재 source diff는 선택 trace/request/derived flow의 source별 coverage와 missing hint 중심이다.
   - 다음 slice는 trace 간 비교, source별 시간축 차이, 또는 동일 request의 source별 event sequence 비교 중 하나로 좁혀야 한다.
   - 추천 조건: 실제 다중 파일 장애 분석 사용성이 우선이면 이 후보가 가장 직접적이다.

2. Span timeline interaction
   - 현재 timeline은 상대 duration을 보여주는 기본 카드 수준이다.
   - 다음 slice는 gantt-like row grouping, span hover/selection, event stream 연동 중 하나로 좁혀야 한다.
   - 추천 조건: trace가 있는 로그를 주로 본다면 시각적 debugging 효율이 가장 크게 오른다.

3. Raw-log-free analysis aids
   - 현재 session snapshot은 view/filter 상태를 저장하지만 bookmark, note, annotation은 없다.
   - 다음 slice는 event bookmark만 먼저 저장할지, free-text note까지 포함할지, snapshot export/import shape를 어떻게 versioning할지 결정해야 한다.
   - 추천 조건: 같은 세션을 반복 분석하거나 handoff하는 사용 흐름이 우선이면 이 후보가 맞다.

4. Desktop/runtime validation depth
   - 현재 selected-file 계약은 jsdom/runtime smoke 중심이고 실제 Tauri 창 자동화는 아직 없다.
   - 다음 slice는 Playwright/browser smoke, Tauri window smoke, 또는 fixture-based render performance check 중 하나로 좁혀야 한다.
   - 추천 조건: UI 변경이 잦아질 예정이면 먼저 테스트 기반을 올리는 편이 안전하다.

## 추천

다음 implementation milestone은 1번 `Trace comparison depth`를 추천한다. 이유는 현재 LogLens의 핵심 가치가 multi-file local debugging이고, 이미 source diff 기반이 있어 작은 slice로 확장하기 쉽기 때문이다.

첫 slice는 `동일 request/trace 안에서 source별 event sequence를 나란히 비교하는 read-only panel`로 잡는 것이 안전하다. 저장 포맷, 파일 접근, parser preset, snapshot 경계를 바꾸지 않고 UI와 analysis helper만 좁게 확장할 수 있다.

## 결정 필요

다음 중 하나를 선택해야 한다.

- A. 추천대로 `Trace comparison depth`를 먼저 진행한다.
- B. UI 시각화를 우선해 `Span timeline interaction`을 먼저 진행한다.
- C. 분석 handoff를 우선해 `Raw-log-free analysis aids`를 먼저 진행한다.
- D. 기능 확장 전에 `Desktop/runtime validation depth`를 먼저 진행한다.

선택 전까지는 이 문서를 active decision gate로 둔다.
