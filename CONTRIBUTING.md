# 기여 가이드

## 에이전트 작업 원칙

LogLens에서 자동화 에이전트는 기본적으로 자율 진행합니다. 사용자에게 되묻는 경우는 [`docs/agent-operating-contract.md`](./docs/agent-operating-contract.md)의 에스컬레이션 조건으로 제한합니다.

작업을 시작할 때는 [`AGENTS.md`](./AGENTS.md)를 짧은 지도처럼 읽고, 상세 맥락은 `docs/`와 [`.agents/skills/loglens/SKILL.md`](./.agents/skills/loglens/SKILL.md)를 따릅니다.

PR/CI 피드백 처리, 데스크톱 검증, 반복 품질 정리까지 포함한 end-to-end 루프는 [`docs/agent-autonomy-playbook.md`](./docs/agent-autonomy-playbook.md)를 따릅니다.

## 검증

기본 검증은 아래 명령입니다.

```bash
pnpm check
```

`pnpm check`는 JavaScript lint, Rust clippy, Vitest, TypeScript/Vite build, Rust test를 순서대로 실행합니다.
중간에 `pnpm check:harness`와 `pnpm check:agent-gc`도 실행되어 에이전트 운영 계약, 자율 실행 플레이북, 주요 문서/코드 경계가 어긋나지 않는지 확인합니다.

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
