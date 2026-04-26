# 에이전트 운영 계약

## 목적

이 문서는 LogLens에서 기대하는 에이전트 작업 방식을 저장소 안의 규칙으로 고정합니다. 목표는 사용자가 세밀하게 개입하지 않아도 에이전트가 구현, 검증, 문서화, commit, publish를 이어갈 수 있게 만드는 것입니다.

기본 형태는 harness engineering 방식에 맞춥니다. 짧은 `AGENTS.md`는 지도 역할만 하고, 오래 유지되어야 하는 지식은 versioned docs에 두며, 가능한 피드백 루프는 실행 가능한 명령으로 둡니다.

## 기본 자율성 정책

작업을 아래 정보로 해결할 수 있으면 에이전트는 자율적으로 계속 진행합니다.

- 사용자 요청
- `AGENTS.md`
- 이 문서
- `docs/status.md`
- `docs/next-phase-spec.md`
- `docs/repository-overview.md`
- 로컬 코드, 테스트, 도구 출력

기존 프로젝트 패턴에서 보수적인 선택을 할 수 있다면 선호 질문을 위해 멈추지 않습니다.

## 에스컬레이션 조건

아래 조건 중 하나가 있을 때만 사용자를 호출합니다.

- **권한 누락**: 필요한 credential, 계정, private file, 외부 시스템 접근이 없습니다.
- **파괴적이거나 되돌리기 어려운 작업**: history rewrite, data deletion, remote bookmark 이동이 사용자에게 이미 요청되지 않았습니다.
- **제품 판단 공백**: 두 선택지가 사용자 경험을 크게 바꾸고 저장소 문서에서 선호를 추론할 수 없습니다.
- **외부 비용 또는 노출**: 유료 인프라를 만들거나, 민감한 내용을 publish하거나, 파일/네트워크 접근 범위를 넓힙니다.
- **지침 충돌**: repo-local 지침과 최신 사용자 요청을 동시에 만족할 수 없습니다.
- **검증 차단**: 필요한 검증을 로컬에서 실행할 수 없고, 신뢰할 수 있는 더 작은 대체 검증도 없습니다.

사용자가 commit과 push를 명시적으로 요청했다면 해당 작업의 remote publish는 이미 승인된 것으로 봅니다. 다만 diff에 예상하지 못한 파괴적 변경이나 민감한 변경이 포함되면 다시 확인합니다.

## 에이전트 작업 루프

1. **방향 잡기**
   - `jj status`를 실행합니다.
   - 현재 작업에 필요한 최소한의 문서와 소스 파일을 읽습니다.
   - 넓은 탐색보다 `rg`와 repo-local reference를 우선합니다.

2. **계획**
   - 단순 작업은 바로 진행합니다.
   - 여러 파일을 건드리거나 리스크가 있는 작업은 짧은 checklist를 두고 단계별로 갱신합니다.
   - 사용자가 특정 bug나 feature가 아니라 넓은 진전을 요청했다면 `docs/next-phase-spec.md`를 ordered backlog로 사용합니다.

3. **구현**
   - 기존 React, TypeScript, Tailwind, shadcn/ui, Tauri, Rust 패턴을 따릅니다.
   - parsing과 analysis 동작은 `src/lib/logs/` 안에 둡니다.
   - explorer UI 컴포넌트는 `src/features/log-explorer/` 안에 둡니다.
   - Rust native code는 desktop integration과 file access에 집중합니다.
   - parser, analysis, state, UI 동작을 바꾸면 해당 테스트를 추가하거나 갱신합니다.

4. **문서화**
   - 동작, workflow, 우선순위, 수용된 제약이 바뀌면 `README.md`, `docs/status.md`, `docs/roadmap.md`, `docs/next-phase-spec.md` 중 적절한 문서를 갱신합니다.
   - 문서는 구현된 동작에 맞춰 유지합니다. 계획된 기능을 이미 shipping된 것처럼 쓰지 않습니다.

5. **검증**
   - 반복 중에는 focused check를 사용합니다.
   - commit/push 전에는 docs-only 변경이어도 `pnpm check`를 실행합니다. publish되는 상태에는 명확한 품질 신호가 남아야 합니다.
   - harness나 운영 문서를 바꿨다면 `pnpm check:harness` 실패를 먼저 해소한 뒤 전체 gate로 넘어갑니다.

6. **Publish**
   - change description을 쓰기 전에 `jj diff`를 검토합니다.
   - 저장소 commit message convention에 맞춰 `jj describe`를 사용합니다.
   - bookmark 이동은 사용자가 요청했거나 publish 요청으로 이미 암시된 경우에만 수행합니다.
   - push는 `jj git push --remote origin -b <bookmark>`를 사용합니다.

## 검증 계층

반복 중에는 실패 가능성이 가장 높은 부분을 잡는 가장 작은 검증을 사용합니다.

```bash
pnpm lint:js
pnpm lint:rust
pnpm test
pnpm build
pnpm test:rust
```

publish 전에는 전체 gate를 사용합니다.

```bash
pnpm check
```

`pnpm check`는 JavaScript lint, Rust clippy, Vitest, TypeScript/Vite build, Rust test를 실행합니다. `lefthook` pre-push와 GitHub Actions도 같은 명령을 사용합니다.

`pnpm check:harness`는 `pnpm check` 안에서 실행되며, 짧은 `AGENTS.md`, 에스컬레이션 계약, publish gate, 선택 파일 접근 scope, 현재 문서의 주요 런타임 설명이 서로 드리프트하지 않는지 확인합니다. 이 검증이 실패하면 먼저 문서나 코드 중 실제 source of truth를 맞춥니다.

UI 비중이 큰 변경은 가능하면 앱을 실행해 변경된 흐름을 확인합니다. 별도 fixture가 필요하지 않다면 sample trace session을 기본 확인 대상으로 사용합니다.

## 실패 복구

검증이 실패하면 아래 순서로 처리합니다.

1. 첫 번째 actionable error를 읽고 최소 책임 변경을 찾습니다.
2. 넓은 rewrite 없이 로컬에서 수정합니다.
3. 실패했던 검증을 다시 실행합니다.
4. publish 전에는 `pnpm check`를 다시 실행합니다.
5. 외부 상태가 없어 실패하거나 저장소 계약 밖의 제품 판단이 필요한 경우에만 에스컬레이션합니다.

테스트를 약화하거나 lint rule을 풀거나 coverage를 지워 실패를 숨기지 않습니다. 사용자가 그런 policy change를 명시적으로 요청했다면 문서를 함께 갱신해 이유를 남깁니다.

## LogLens 제품 가드레일

- LogLens는 local desktop log analysis workbench이며 server-backed observability platform이 아닙니다.
- 사용자가 선택한 파일이 trust boundary입니다. 구체적인 작업과 security note 없이 filesystem access를 넓히지 않습니다.
- 프런트엔드 파일 읽기 경로는 `allow_file_access`를 먼저 호출해 선택된 일반 파일만 Tauri fs scope에 추가한 뒤 `readTextFileLines()` 또는 fallback 읽기를 사용합니다.
- Parser heuristic은 설명 가능해야 합니다. 조용한 추측보다 diagnostics와 test를 우선합니다.
- Large-log 작업은 memory와 rendering cost를 함께 고려합니다.
- 새 visualization은 debugging을 위한 dense하고 scan-friendly한 workflow를 유지해야 합니다.

## Commit과 Push 규칙

기본 VCS는 `jj`입니다.

```bash
jj status
jj diff
jj describe -m $'docs: summary\n\nCo-authored-by: Codex (AI-generated) <codex@1day1coding.com>'
jj bookmark set master -r @
jj git push --remote origin -b master
```

Commit message 규칙:

- 형식은 `<type>: <summary>`입니다.
- scope 괄호는 쓰지 않습니다.
- Codex co-author trailer를 정확히 한 번 포함합니다.
- 관련 없는 사용자 변경은 그대로 둡니다.

## 지속 개선

에이전트가 누락된 맥락, 반복되는 tool failure, 불명확한 architecture, 애매한 acceptance criteria 때문에 막히면 task를 해결한 뒤 harness도 보강합니다. 보통 이 문서, 관련 status/spec 문서, 또는 `.agents/skills/loglens/SKILL.md`에 짧은 규칙을 추가합니다.
