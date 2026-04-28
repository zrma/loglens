# 에이전트 자율 실행 플레이북

## 목적

이 문서는 `docs/agent-operating-contract.md`의 운영 계약을 실제 실행 루프로 내립니다. 목표는 사용자가 매 단계 지시하지 않아도 에이전트가 구현, 검증, 리뷰 대응, publish, 품질 정리를 이어가게 만드는 것입니다.

`AGENTS.md`는 지도, 운영 계약은 정책, 이 문서는 실행 절차입니다.

## End-to-end 루프

일반 기능 또는 버그 작업은 아래 순서로 닫습니다.

1. `jj status`로 작업 트리를 확인합니다.
2. 관련 문서와 소스만 읽고, 넓은 목표라면 `docs/status.md`와 `docs/roadmap.md`에서 다음 후보를 고릅니다.
3. 버그라면 먼저 현재 실패나 부족한 동작을 재현 가능한 테스트, smoke, fixture, 또는 명확한 수동 관찰로 고정합니다.
4. 최소 책임 범위로 구현합니다.
5. 변경 범위에 맞는 focused check를 먼저 실행합니다.
6. 실패하면 같은 루프 안에서 수정하고 실패한 검증부터 다시 실행합니다.
7. `jj diff`로 unrelated churn, 민감 정보, 의도하지 않은 파일 변경을 확인합니다.
8. publish 전에는 `pnpm check`를 실행합니다.
9. commit/push 요청이 있으면 `jj describe`, bookmark 갱신, `jj git push`까지 진행합니다.
10. push 이후 CI나 리뷰 피드백을 확인할 수 있으면 다시 루프에 넣고, 운영 계약의 에스컬레이션 조건에 걸릴 때만 사용자에게 묻습니다.

## 데스크톱 검증

UI, 파일 선택, Tauri fs scope, line-stream fallback, windowing, 또는 사용자가 직접 만지는 흐름을 바꾼 경우에는 제품 동작이 agent-legible한지 확인합니다.

기본 순서:

1. `pnpm check:runtime-smoke`로 selected-file runtime 계약을 확인합니다.
2. UI 상태나 탭 흐름을 바꿨으면 `pnpm test`의 App smoke coverage를 갱신합니다.
3. 실제 Tauri 창 자동화가 필요한 변경인데 현재 repo 도구로 자동화할 수 없으면, 수동 앱 확인으로 관찰 근거를 남기거나 먼저 자동화 하네스를 추가합니다.
4. 수동 확인 없이도 충분한 fixture/smoke로 검증 가능한 경우에는 사용자에게 확인을 요청하지 않습니다.

현재 저장소는 Tauri WebDriver 또는 OS-level desktop automation을 기본 gate로 갖고 있지 않습니다. 그러므로 native 창 자체가 리스크인 변경은 `pnpm check:runtime-smoke`만으로 닫지 말고, 실행 가능한 대체 검증이나 명시적 수동 관찰을 남깁니다.

## PR/CI 피드백 루프

commit/push 또는 PR publish 요청이 있으면 아래 루프를 기본값으로 봅니다.

1. `pnpm check`를 통과시킵니다.
2. `jj diff`를 검토합니다.
3. `jj describe -m $'<type>: <summary>\n\nCo-authored-by: Codex (AI-generated) <codex@1day1coding.com>'`로 메시지를 설정합니다.
4. target bookmark를 `jj bookmark set <bookmark> -r @`로 갱신합니다.
5. `jj git push --remote origin -b <bookmark>`로 publish합니다.
6. GitHub 접근이 가능하면 Actions 상태와 PR 리뷰 피드백을 확인합니다.
7. 실패 로그나 actionable review comment가 있으면 수정, focused check, `pnpm check`, push를 반복합니다.
8. credential, private review context, 제품 판단, 또는 외부 권한이 막히는 경우에만 에스컬레이션합니다.

PR이 필요한 흐름에서는 `gh pr status`, `gh pr view --comments`, `gh run list`, `gh run watch`, `gh run view --log-failed` 같은 표준 도구를 사용합니다. 도구가 없거나 인증이 없으면 그 사실을 에스컬레이션 패킷에 포함합니다.

## 품질 GC

자율성이 높아질수록 작은 문서 드리프트와 품질 부채가 누적됩니다. 이 저장소에서는 주기적으로 아래를 확인합니다.

1. `pnpm check:agent-gc`를 실행합니다.
2. stale marker, 개인 절대 경로, 큰 정책 누락, playbook 누락을 정리합니다.
3. 반복되는 실패가 있으면 해당 규칙을 `scripts/check-agent-harness.mjs` 또는 `scripts/check-agent-gc.mjs`에 추가합니다.
4. 구현된 동작과 문서가 어긋나면 코드와 문서 중 실제 source of truth를 맞춥니다.
5. 유지보수 백로그는 `docs/roadmap.md`에 남기고, 현재 위험은 `docs/status.md`에 남깁니다.

`pnpm check:agent-gc`는 작은 기계적 방어선입니다. 제품 의미를 대신 판단하지 않으며, 반복적으로 발견되는 드리프트를 빠르게 잡는 용도입니다.

## 에스컬레이션 패킷

사용자 호출이 필요한 경우에는 질문만 던지지 말고 아래 정보를 함께 제공합니다.

- 막힌 조건이 운영 계약의 어느 에스컬레이션 조건인지
- 이미 시도한 명령과 결과
- 가능한 선택지와 각 선택지의 리스크
- 사용자가 결정해야 하는 최소 판단
- 결정 이후 에이전트가 이어서 수행할 다음 단계

에스컬레이션 이후 승인이 주어지면 같은 작업 루프로 돌아가 끝까지 진행합니다.
