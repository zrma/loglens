# Trace sequence comparison

## 상태

- Active milestone
- Decision source: `docs/todo-next-product-milestones.md`의 추천 A를 채택한다.
- First slice implemented: source별 bounded event sequence preview
- Second slice implemented: sequence event route/method context badges

## 목표

동일 trace/request/derived flow 안에서 source별 이벤트 순서를 나란히 비교하는 read-only panel을 추가한다. 현재 Cross-file Trace Diff가 source별 coverage와 missing hint를 보여주므로, 첫 slice는 같은 선택 범위 안에서 "어느 source가 어떤 순서로 어떤 이벤트를 냈는지"를 빠르게 훑는 데 집중한다.

## 첫 slice 범위

- 완료. `src/lib/logs/`에 source별 event sequence preview helper를 추가했다.
- 완료. traceId가 있으면 trace 기준, 없으면 requestId, 없으면 derived flow 기준으로 기존 diff fallback 순서를 따른다.
- 완료. 각 source마다 최대 preview event 수를 제한해 대용량 세션에서 bounded 계산을 유지한다.
- 완료. UI에는 선택된 trace/request/derived flow의 source별 sequence preview를 read-only로 표시한다.
- 완료. event row 클릭은 기존 이벤트 선택 흐름으로 연결한다.

## 다음 slice 후보

- 선택 이벤트 위치 주변의 source-local window를 보여줄지, 항상 첫 이벤트 preview를 유지할지 결정한다.
- sequence comparison을 analysis tab에도 요약으로 노출할지 결정한다.

## 비범위

- raw 로그 본문 저장, session snapshot schema 변경, 자동 파일 재열기
- source별 sequence diff 알고리즘 고도화
- gantt/timeline interaction
- 디스크 기반 인덱싱

## 수용 기준

- 완료. 다중 source session에서 선택 trace/request/derived flow의 source별 event 순서를 볼 수 있다.
- 완료. trace가 없는 로그는 requestId 또는 derived flow fallback으로 sequence panel을 볼 수 있다.
- 완료. source별 preview는 bounded count를 넘지 않는다.
- 완료. source sequence helper와 UI smoke test가 추가된다.
- 완료. publish 전 `pnpm check`가 통과한다.

## 검증

```bash
pnpm test src/lib/logs/parser.test.ts src/test/app.smoke.test.tsx
pnpm check
```

## 에스컬레이션 조건

- sequence 비교를 저장 상태나 snapshot schema에 포함해야 한다면 사용자 판단이 필요하다.
- event order의 기준을 timestamp 정렬로 바꾸는 요구가 나오면 원본 로그 순서 보존과 충돌할 수 있어 사용자 판단이 필요하다.
