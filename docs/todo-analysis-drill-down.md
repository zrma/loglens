# Analysis Drill-down 연결 작업 목록

## 목표

분석 탭에서 본 시간대, level, service, request, diagnostic 분포를 바로 이벤트 범위 조정으로 이어가게 한다. 분석 탭에서 만든 조건은 기존 sidebar 필터와 함께 적용하되, 별도 chip으로 보여주고 개별/전체 해제가 가능해야 한다.

## 구현 항목

- [ ] `DrillDownFilter` 상태 모델을 추가한다.
- [ ] hour bucket, level, service, request, diagnostic 조건을 기존 이벤트 필터 결과에 결합한다.
- [ ] 분석 탭 상단에 현재 분석 범위 chip 영역을 추가한다.
- [ ] hour chart 클릭 시 시간 bucket drill-down을 적용한다.
- [ ] level/service/request 분포 row 클릭 시 대응 필터를 적용한다.
- [ ] Parser Diagnostics 분포 row 클릭 시 diagnostic kind 필터를 적용한다.
- [ ] drill-down 조건을 개별 해제할 수 있게 한다.
- [ ] `분석 조건만 해제`와 기존 `모든 조건 초기화`가 구분되게 한다.
- [ ] 이벤트 탭과 분석 탭 전환 후에도 drill-down 상태가 유지되게 한다.
- [ ] App smoke test에 분석 탭 drill-down 적용/해제 흐름을 추가한다.

## 수용 기준

- 분석 탭에서 chart 또는 분포 row 클릭만으로 이벤트 범위가 줄어든다.
- 이벤트 탭으로 돌아가도 분석 탭에서 만든 조건이 유지된다.
- 사용자는 현재 적용된 분석 조건을 chip으로 볼 수 있다.
- 사용자는 분석 조건을 개별 또는 전체 해제할 수 있다.
- sidebar의 모든 필터 초기화와 분석 조건만 해제가 구분된다.
- `pnpm test`, `pnpm build`, `pnpm lint:js`, `pnpm check`가 통과한다.

## 다음 마일스톤

이 작업이 완료되면 `docs/next-phase-spec.md`의 네 번째 항목인 Cross-file Trace Diff로 넘어간다.

## 검증

- `pnpm test -- src/test/app.smoke.test.tsx`
- `pnpm lint:js`
- `pnpm build`
- `pnpm check`
