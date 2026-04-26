# 디자인 시스템 GC 작업 목록

## 목표

기능 변경 없이 UI 컴포넌트 사용 범위를 점검하고, 반복해서 생길 수 있는 작은 불일치를 기계적으로 잡는다. 큰 시각 개편은 하지 않고 현재 dense workbench 스타일을 유지한다.

## 구현 항목

- [x] 주요 명령형 액션은 기존 `Button`, `Input`, `Select`, `Card`, `Tabs` 컴포넌트 사용을 유지하는지 확인한다.
- [x] 리스트 행, chip, 가상화 row처럼 의미상 맞춤 렌더링이 필요한 raw `<button>`은 유지한다.
- [x] raw `<button>`에 `type="button"`을 명시한다.
- [x] `pnpm check:agent-gc`가 raw `<button>`의 explicit type 누락을 잡게 한다.

## 수용 기준

- raw `<button>` 중 implicit submit 동작을 남기는 항목이 없다.
- command button을 새로 만들 때는 `Button` 컴포넌트를 우선 사용하고, chip/list row는 raw button을 허용한다.
- `pnpm check:agent-gc`, `pnpm lint:js`, `pnpm test -- src/test/app.smoke.test.tsx`, `pnpm check`가 통과한다.

## 진행 메모

- 2026-04-26: 디자인 시스템 사용 범위는 현재 구조에 맞게 유지하고, raw chip/list button의 explicit type만 기계적으로 고정했다.
