# 저장소 개요

## 한 줄 요약

이 저장소는 Tauri 데스크톱 셸 위에서 React UI로 로컬 로그 파일을 열고, 구조화 이벤트로 파싱하고, trace/span 단서를 기준으로 탐색하는 로그 워크벤치 프로토타입입니다. 제품 의도는 그보다 더 넓어서, 장기적으로는 로컬 로그 분석과 trace/span 탐색까지 지원하는 디버깅 워크벤치를 목표로 합니다.

## 제품 방향

현재 코드베이스에서 읽히는 기능은 단순 로그 뷰어지만, 프로젝트 의도는 다음 방향에 가깝습니다.

- 로그를 모아 빠르게 검색하고 필터링한다.
- 서로 다른 로그 이벤트 사이의 상관관계를 따라간다.
- 요청 단위의 흐름을 trace/span처럼 시각화한다.
- 장애 분석과 디버깅에 필요한 컨텍스트를 한 화면에서 탐색한다.

즉, "로그 파일 열기 앱"이 최종 목적이 아니라, 로컬 개발/운영 디버깅을 위한 분석 도구가 목표입니다.

## 현재 사용자 플로우

1. 사용자가 `로그 파일 선택` 버튼을 누른다.
2. Tauri dialog 플러그인으로 `.log` 또는 `.txt` 파일 하나를 고른다.
3. 프런트엔드가 선택된 파일 경로를 받아 텍스트 파일을 읽는다.
4. 파일 내용을 구조화 이벤트로 파싱한다.
5. 검색어, level, service, trace 기준으로 이벤트를 필터링한다.
6. `이벤트` 탭에서 구조화된 이벤트 목록과 상세 패널을 보여준다.
7. 선택한 이벤트에 traceId가 있으면 관련 이벤트 흐름을 묶어 보여준다.
8. `분석` 탭에서는 인식 가능한 타임스탬프를 파싱해 시간대별 추이와 분포를 보여준다.

## 런타임 구조

### Frontend

- 위치: [`src/App.tsx`](../src/App.tsx)
- 역할:
- 파일 선택 버튼과 현재 선택 경로 표시
- 로그 파일 읽기와 샘플 세션 로드
- 구조화 이벤트 기준 상태 관리
- 검색어/level/service/trace 필터링
- 선택 이벤트 상세 패널 렌더링
- trace 그룹 목록과 관련 이벤트 흐름 표시
- 시간대별 집계 차트 렌더링
- 이벤트/분석 탭 렌더링

실제 화면 조립은 이 파일이 담당하지만, 파싱과 집계 로직은 `src/lib/logs`로 분리되었습니다.

### Tauri / Rust

- 위치: [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs)
- 역할:
- `tauri-plugin-dialog`, `tauri-plugin-fs`, `tauri-plugin-opener` 초기화
- 선택 파일 단위 파일 시스템 scope 설정
- 앱 실행 부트스트랩

중요한 점은, 현재 Rust 레이어가 로그 파싱이나 집계를 수행하지 않는다는 것입니다. Rust는 네이티브 기능 접근과 접근 범위 제어를 제공하는 얇은 셸 역할에 가깝습니다.

## 주요 상태와 데이터 흐름

- `logFile`: 현재 선택된 파일 경로
- `logLines`: 빈 줄을 제거한 로그 라인 배열
- `searchTerm`: 검색 입력값
- `activeTab`: 현재 선택된 탭
- `errorMessage`: 파일 선택/읽기 실패 메시지

데이터 흐름은 `파일 선택 -> 텍스트 읽기 -> 줄 배열 생성 -> 검색 필터 -> 테이블/차트 렌더링` 순서입니다.

## 폴더별 역할

- [`src`](../src): React 애플리케이션 본체
- [`src/components/ui`](../src/components/ui): shadcn/ui 기반 공용 UI 컴포넌트
- [`src/lib/logs`](../src/lib/logs): 로그 도메인 타입, 파서, 분석 로직, 샘플 fixture, 테스트
- [`src-tauri`](../src-tauri): Tauri 설정과 Rust 엔트리포인트
- [`public`](../public): 정적 에셋

## 현재 한계

- 파서는 JSON line, key=value, plain text timestamp prefix까지만 안정적으로 지원한다.
- trace/span 단서 추출은 들어갔지만, 관계 시각화는 아직 목록/상세 패널 수준이다.
- 대용량 파일 스트리밍이나 가상 스크롤이 없어 큰 로그 파일에서는 비효율적일 수 있다.
- 오류 메시지 표시는 추가됐지만, 자세한 진단과 복구 흐름은 아직 단순하다.
- 테스트는 parser smoke 수준만 있다.

## 유지보수 관점에서 중요한 사실

- [`src-tauri/capabilities/default.json`](../src-tauri/capabilities/default.json) 에 파일 열기와 파일 시스템 접근 권한이 선언되어 있습니다.
- [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs) 는 `allow_file_access` 커맨드로 사용자가 고른 파일만 접근 허용합니다.
- [`src/App.css`](../src/App.css) 에도 기본 템플릿 스타일 흔적이 남아 있지만, 현재 엔트리포인트에서는 `index.css`만 import합니다.

## 다음에 손대기 좋은 영역

- correlation ID와 request ID를 포함한 더 풍부한 연결 규칙
- 큰 파일 대응을 위한 스트리밍/가상화
- Rust 또는 별도 도메인 레이어로 분석 로직 분리
- 시각화와 테스트 확장
