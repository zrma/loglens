# LogLens

로컬 `.log`/`.txt` 파일을 데스크톱에서 열어 빠르게 훑고 검색하는 Tauri 기반 로그 뷰어입니다. 장기적으로는 Kibana나 로컬 log explorer처럼 로그 탐색, 관계 추적, span/trace 시각화, 디버깅 보조에 초점을 둔 로컬 분석 도구를 목표로 합니다. 현재 저장소의 구현 상태는 그 방향을 향한 초기 부트스트랩 단계에 가깝습니다.

## 프로젝트 의도

이 저장소는 "로컬 환경에서 가볍게 실행되는 로그 분석 워크벤치"를 지향합니다.

- 여러 로그를 빠르게 열고 검색할 수 있어야 한다.
- 로그 사이의 관계를 추적하고 디버깅 흐름을 재구성할 수 있어야 한다.
- trace/span 같은 실행 흐름을 시각적으로 탐색할 수 있어야 한다.
- 서버나 별도 인프라 없이 로컬에서 바로 분석을 시작할 수 있어야 한다.
- Kibana류 도구보다 설정 부담이 적고, 개발자 디버깅에 더 직접적으로 도움을 줘야 한다.

## 이 저장소가 하는 일

- Tauri 파일 선택 다이얼로그로 로그 파일 1개를 연다.
- 선택한 텍스트 로그를 읽어서 줄 단위 배열로 변환한다.
- 원본 로그를 스크롤 가능한 테이블로 보여준다.
- 검색어를 기준으로 로그 라인을 부분 검색한다.
- 인식 가능한 타임스탬프가 있는 로그에 대해 시간대별 분포를 시각화한다.

## 현재 구현 상태

### 구현된 기능

- `.log`, `.txt` 파일 단일 선택
- 로컬 파일 읽기
- 빈 줄 제거 후 로그 라인 목록 표시
- 대소문자 구분 없는 부분 검색
- `원본 로그` / `분석` 탭 전환 UI
- 공통 로그 타임스탬프 형식 기반 시간대 집계
- 선택한 파일만 Tauri 파일 시스템 scope에 동적으로 허용

### 아직 구현되지 않은 부분

- 다양한 로그 포맷과 멀티라인 로그에 대한 안정적인 파싱
- 에러 레벨, 서비스명 등 구조화된 로그 분석
- 여러 파일 동시 비교
- trace/span 관계 모델링과 시각화
- 테스트 코드

현재 분석은 공통적인 숫자형 타임스탬프(`YYYY-MM-DD HH:mm:ss`, ISO 형식, `YYYY/MM/DD HH:mm:ss`)에 대해서만 동작합니다. 저장소 목적은 "로그 분석 워크벤치"에 가깝지만, 현재 구현은 아직 "로컬 로그 뷰어 + 기초 시간대 분석" 단계입니다.

## 구조 요약

- 프런트엔드: React + TypeScript + Vite
- 데스크톱 셸: Tauri v2
- UI: Tailwind CSS + shadcn/ui
- 차트: Recharts
- 네이티브 레이어 역할: 창 생성, 파일 선택 다이얼로그, 파일 시스템 접근 권한 제공

현재 로그 처리 로직은 대부분 [`src/App.tsx`](./src/App.tsx)에 있으며, Rust 쪽은 분석 엔진이라기보다 얇은 Tauri 셸에 가깝습니다.

## 주요 파일

- [`src/App.tsx`](./src/App.tsx): 파일 선택, 파일 읽기, 검색, 타임스탬프 파싱, 시간대 차트 표시
- [`src/main.tsx`](./src/main.tsx): React 엔트리포인트
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
