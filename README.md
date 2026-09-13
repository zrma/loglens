# LogLens

로컬 `.log`·`.txt` 파일을 열어 검색하고, 여러 파일의 trace/span 흐름을 함께 살펴보는
Tauri 데스크톱 로그 분석 도구입니다. 별도 로그 서버 없이 분석하는 MVP입니다.

## 주요 기능

- 여러 파일을 한 세션으로 열고 source·level·service·trace·request·필드 값으로 검색합니다.
- JSON line, key=value, 일부 텍스트·멀티라인 로그를 파싱하고 preset과 필드 alias를 조정합니다.
- 이벤트 상세, span 관계와 timeline, 여러 파일 간 Trace Diff로 흐름의 누락을 찾습니다.
- Parser Diagnostics와 시간대·필드 분포를 눌러 분석 범위를 좁힙니다.
- parser·필터·화면 설정을 로컬 JSON snapshot으로 저장하고 다시 적용합니다.
- 샘플 trace 세션으로 파일을 준비하기 전에 화면과 분석 흐름을 확인할 수 있습니다.

지원 형식과 파싱 한계는 [로그 형식 안내](docs/log-format-support.md)를 참고하세요.

## 실행

Node.js, [package.json](package.json)에 고정된 `pnpm`, Rust toolchain과
Tauri 데스크톱 빌드 도구가 필요합니다. 저장소 루트에서 실행합니다.

```sh
pnpm install
pnpm tauri dev
```

앱에서 로그 파일을 선택하거나 샘플 세션을 연 뒤, 이벤트 목록의 필터와 분석 탭을 사용합니다.
파일 접근은 사용자가 선택한 일반 파일로 제한됩니다.

앱 번들은 다음 명령으로 만듭니다.

```sh
pnpm tauri build
```

## 현재 한계

- 파일은 줄 단위로 읽지만 전체 이벤트와 집계는 메모리에 유지합니다. 디스크 기반 인덱싱은 없습니다.
- Trace Diff는 파일별 coverage와 누락 단서를 비교하며 완전한 분산 추적 복원을 보장하지 않습니다.
- JSON snapshot에는 원본 로그와 자동 파일 재열기가 포함되지 않습니다. 같은 로그를 연 세션에 분석 설정을 복원합니다.
- span timeline은 기본 탐색 수준이며, 더 정교한 시각화와 데스크톱 성능 측정은 후속 작업입니다.

## 개발과 문서

전체 로컬 검증은 `pnpm check`입니다. 상세 명령·기여·VCS 절차는
[기여 가이드](CONTRIBUTING.md), AI 작업 지침은 [AGENTS.md](AGENTS.md)를 참고하세요.

- [구현 상태](docs/status.md) · [로드맵](docs/roadmap.md)
- [구조와 데이터 흐름](docs/repository-overview.md) · [분석 계약](docs/analysis-contract.md)
- [완료된 작업과 검증 범위](docs/completed-milestones.md)

## 라이선스

MIT
