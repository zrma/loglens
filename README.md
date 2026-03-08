# LogLens

로컬 `.log`/`.txt` 파일을 데스크톱에서 열어 빠르게 훑고 검색하는 Tauri 기반 로그 워크벤치입니다. 장기적으로는 Kibana나 로컬 log explorer처럼 로그 탐색, 관계 추적, span/trace 시각화, 디버깅 보조에 초점을 둔 로컬 분석 도구를 목표로 합니다. 현재 저장소는 초기 부트스트랩 단계이지만, 구조화 이벤트 추출과 trace 탐색의 최소 기능까지는 들어간 상태입니다.

## 프로젝트 의도

이 저장소는 "로컬 환경에서 가볍게 실행되는 로그 분석 워크벤치"를 지향합니다.

- 여러 로그를 빠르게 열고 검색할 수 있어야 한다.
- 로그 사이의 관계를 추적하고 디버깅 흐름을 재구성할 수 있어야 한다.
- trace/span 같은 실행 흐름을 시각적으로 탐색할 수 있어야 한다.
- 서버나 별도 인프라 없이 로컬에서 바로 분석을 시작할 수 있어야 한다.
- Kibana류 도구보다 설정 부담이 적고, 개발자 디버깅에 더 직접적으로 도움을 줘야 한다.

## 이 저장소가 하는 일

- Tauri 파일 선택 다이얼로그로 로그 파일 1개를 연다.
- 선택한 텍스트 로그를 구조화 이벤트로 파싱한다.
- 이벤트 목록과 상세 패널을 함께 보여준다.
- 검색어, level, service, trace 기준으로 이벤트를 필터링한다.
- 인식 가능한 타임스탬프가 있는 로그에 대해 시간대별 분포를 시각화한다.
- trace/span/request ID를 추출해 관련 이벤트를 묶어 보여준다.
- 샘플 trace 세션을 불러와 UI를 바로 확인할 수 있다.

## 현재 구현 상태

### 구현된 기능

- `.log`, `.txt` 파일 단일 선택
- 로컬 파일 읽기
- 구조화 이벤트 파싱(JSON line / key=value / plain text 일부)
- 검색어, level, service, trace 기반 필터링
- 선택 이벤트 상세 패널
- 관련 trace 이벤트 묶음 표시
- `이벤트` / `분석` 탭 전환 UI
- 공통 로그 타임스탬프 형식 기반 시간대 집계
- 선택한 파일만 Tauri 파일 시스템 scope에 동적으로 허용
- 샘플 trace 세션 로드
- 파서/trace 분석 smoke test

### 아직 구현되지 않은 부분

- 다양한 로그 포맷과 멀티라인 로그에 대한 안정적인 파싱
- 에러 레벨 외의 더 풍부한 구조화 필드 정규화
- 여러 파일 동시 비교
- trace/span 관계의 더 정교한 시각화
- 대용량 로그 대응 최적화

현재 파서는 JSON line, key=value, plain text timestamp prefix를 최소 범위로 지원합니다. 저장소 목적은 "로그 분석 워크벤치"에 가깝고, 현재 구현은 "구조화 로그 탐색 + 기초 trace 탐색 MVP" 단계입니다.

## 구조 요약

- 프런트엔드: React + TypeScript + Vite
- 데스크톱 셸: Tauri v2
- UI: Tailwind CSS + shadcn/ui
- 차트: Recharts
- 네이티브 레이어 역할: 창 생성, 파일 선택 다이얼로그, 파일 시스템 접근 권한 제공

현재 로그 처리 로직은 대부분 [`src/App.tsx`](./src/App.tsx)에 있으며, Rust 쪽은 분석 엔진이라기보다 얇은 Tauri 셸에 가깝습니다.

## 주요 파일

- [`src/App.tsx`](./src/App.tsx): 세션 로드, 구조화 필터, trace 탐색, 상세 이벤트 패널, 시간대 차트
- [`src/main.tsx`](./src/main.tsx): React 엔트리포인트
- [`src/lib/logs/parser.ts`](./src/lib/logs/parser.ts): 구조화 로그 파서
- [`src/lib/logs/analysis.ts`](./src/lib/logs/analysis.ts): 필터링, trace 그룹화, 시간대 집계
- [`src/lib/logs/sample.ts`](./src/lib/logs/sample.ts): 샘플 trace 세션 fixture
- [`src-tauri/src/lib.rs`](./src-tauri/src/lib.rs): Tauri 플러그인 등록과 선택 파일 단위 접근 허용
- [`src-tauri/capabilities/default.json`](./src-tauri/capabilities/default.json): 메인 창 권한 선언
- [`src-tauri/tauri.conf.json`](./src-tauri/tauri.conf.json): 개발 서버 연결, 창 크기, 번들 설정

더 자세한 내부 구조는 [`docs/repository-overview.md`](./docs/repository-overview.md)를 참고하세요.

제품 방향과 후속 작업은 [`docs/roadmap.md`](./docs/roadmap.md)에서 정리합니다.

## 실행

```bash
pnpm install
pnpm tauri dev
```

프런트엔드 정적 빌드만 만들려면:

```bash
pnpm build
pnpm test
```

데스크톱 앱 번들을 만들려면:

```bash
pnpm tauri build
```

## 코드 품질 명령

```bash
pnpm lint
pnpm lint:js
pnpm lint:rust
pnpm test
pnpm format
pnpm format:rust
```

## 권한과 보안 메모

- Tauri capability에는 `dialog`, `fs`, `opener` 권한이 선언되어 있습니다.
- Rust 커맨드 `allow_file_access`가 사용자가 선택한 파일만 파일 시스템 scope에 추가합니다.
- 제품 수준으로 발전시킬 때는 접근 기록, 다중 파일 세션, 분석 로직 분리까지 함께 설계하는 것이 좋습니다.

## 개발자 메모

- 현재 `README`는 "실제 구현된 기능" 기준으로 정리되어 있습니다.
- 2026-03-08 기준으로 JS audit 취약점은 전이 의존성 override까지 반영해 정리했습니다.
- 저장소 안에는 Tauri 기본 템플릿 흔적이 일부 남아 있으며, 대표적으로 [`src/App.css`](./src/App.css)는 현재 엔트리포인트에서 import되지 않습니다.

## 라이선스

MIT
