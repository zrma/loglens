# 기여 가이드

소스 실행은 [README](README.md#실행), 구현 구조와 현재 제약은
[저장소 개요](docs/repository-overview.md), 다음 제품 작업은
[로드맵](docs/roadmap.md)에서 확인합니다.

## 검증

기본 검증은 `pnpm check`입니다. 변경한 동작은 focused 검사로 먼저 확인하고,
commit/push 전에는 문서 변경도 전체 gate를 통과해야 합니다.
sample session의 issue-only 필터와 분석 탭 전환은 agent-legible smoke test로 검증합니다.
파일 읽기와 windowed 목록의 구조는 [저장소 개요](docs/repository-overview.md)가 소유합니다.


```bash
pnpm check
pnpm check:harness
pnpm check:agent-gc
pnpm check:runtime-smoke
pnpm check:bundle
pnpm test:large-regression
pnpm bench:large-session
pnpm lint
pnpm lint:js
pnpm lint:rust
pnpm test
pnpm test:rust
pnpm format
pnpm format:rust
```

`pnpm check`는 `lint + test + build + bundle size check + cargo test`를 순서대로 실행합니다. `lefthook`의 `pre-push`와 GitHub Actions CI도 같은 명령을 사용합니다.
이 명령에는 `pnpm check:harness`와 `pnpm check:agent-gc`도 포함되며, 에이전트 운영 계약, 문서 지도, 자체 리뷰 루프, PR/CI 피드백 절차, 품질 GC 기준, UI smoke coverage, selected-file runtime smoke, 대용량 분석 fixture, 대용량 UI windowing fixture, 선택 파일 접근 경로가 현재 코드와 어긋나지 않는지 확인합니다.

`pnpm check:bundle`은 `pnpm build` 뒤의 `dist/assets/*.js` chunk가 500 KiB 예산을 넘지 않는지 확인합니다. 단독 실행 전에는 먼저 `pnpm build`를 실행해야 합니다.

런타임에 가까운 선택 파일 경로만 빠르게 다시 확인하려면:

```bash
pnpm check:runtime-smoke
```

이 명령은 Vitest 기반 `src/test/runtime-harness.test.tsx`와 Rust `allow_file_access` 테스트를 함께 실행합니다.

대용량 경계는 빠른 회귀와 느린 후보를 분리합니다. `pnpm test:large-regression`은 기본 gate에 들어가는 3,000-event parser/runtime fixture를 실행하고, `pnpm bench:large-session`은 opt-in 200k-line parser/summary benchmark 후보를 실행합니다.

## 작업과 게시

기여자는 변경 목적, 결과와 검증 한계를 설명하고 실제 로그나 개인 환경 정보를
fixture·문서·PR에 첨부하지 않습니다. 로컬 VCS와 게시 절차는
[운영 계약](docs/agent-operating-contract.md#commit과-push-규칙)을 따릅니다.

AI 도구는 [AGENTS.md](AGENTS.md)에서 시작합니다. 상세 실행·검증·PR/CI 절차는
[자율 실행 플레이북](docs/agent-autonomy-playbook.md)이 소유합니다.
일반 사용자를 위한 README에는 이 절차를 복제하지 않습니다.

## 커밋 메시지 컨벤션


이 프로젝트는 다음과 같은 커밋 메시지 컨벤션을 따릅니다:

- feat: 새로운 기능 추가
- fix: 버그 수정
- docs: 문서 변경
- refactor: 코드 리팩토링
- test: 테스트 코드 추가/수정
- build: 빌드 프로세스 또는 의존성 변경
- ci: CI 설정 변경
- chore: 빌드 프로세스 또는 보조 도구 변경

메시지 형식은 `<type>: <summary>`이고 scope 괄호는 쓰지 않습니다.

Codex가 메시지를 작성하거나 수정할 때는 마지막에 아래 trailer를 정확히 한 번 포함합니다.

```text
Co-authored-by: Codex (AI-generated) <codex@1day1coding.com>
```
