# Custom Alias Override UI 작업 목록

## 목표

세션 단위 필드 매핑을 UI에서 보정하고, 현재 parser preset 위에 사용자 alias를 우선 적용한 뒤 세션을 다시 파싱한다.

## 구현 항목

- [x] `useLogSession`이 alias override 상태를 보관한다.
- [x] 샘플 세션과 선택 파일 reload 경로가 alias override를 parser에 전달한다.
- [x] overview 영역에 `필드 매핑` 진입점과 현재 preset 정보를 표시한다.
- [x] canonical field 입력값을 comma-separated alias 목록으로 정규화한다.
- [x] override 적용 시 현재 세션을 다시 파싱한다.
- [x] override 초기화 시 preset 기준 결과로 되돌린다.
- [x] override 활성 상태를 세션 summary badge로 표시한다.
- [x] parser test에 preset과 override 우선순위 케이스를 추가한다.
- [x] App smoke test에 UI 기반 alias override 적용 흐름을 추가한다.

## 수용 기준

- `message=M`, `timestamp=T` 같은 매핑을 UI에서 입력할 수 있다.
- 적용 후 현재 세션이 같은 파일 또는 샘플 데이터로 즉시 다시 파싱된다.
- 빈 override 상태로 되돌리면 preset만 적용된 결과가 된다.
- active override가 있을 때 overview summary에 `custom alias active`가 보인다.
- `pnpm test`, `pnpm build`, `pnpm lint:js`가 통과한다.

## 다음 마일스톤

이 작업이 완료되면 `docs/next-phase-spec.md`의 두 번째 항목인 Parser Diagnostics 강화로 넘어간다.

## 검증

- `pnpm test -- src/lib/logs/parser.test.ts src/test/app.smoke.test.tsx`
- `pnpm lint:js`
- `pnpm build`
- `pnpm check`
