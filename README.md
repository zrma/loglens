# LogLens - 로컬 로그 파일 분석 도구

Tauri, React, TypeScript로 개발된 로컬 로그 파일 분석 애플리케이션입니다.

## 주요 기능

- 로그 파일 선택 및 내용 표시
- 로그 내용 검색
- 시간별 로그 발생 빈도 시각화

## 기술 스택

- Tauri v2, React, TypeScript
- Tailwind CSS, shadcn/ui
- Recharts

## 설치 및 실행

```bash
# 의존성 설치
pnpm install

# 개발 서버 실행
pnpm tauri dev

# 빌드
pnpm tauri build
```

## 문제 해결

Tauri v2에서 dialog 플러그인 권한이 필요합니다. `capabilities/default.json` 파일에 다음 권한을 추가하세요:

```json
"permissions": ["dialog:default", "dialog:allow-open", "fs:default"]
```

## 코드 품질 관리

이 프로젝트는 코드 품질을 유지하기 위해 다음 도구들을 사용합니다:

- **lefthook**: Git 훅 관리 도구
- **oxlint**: JavaScript/TypeScript 코드 린팅 도구
- **clippy**: Rust 코드 린팅 도구
- **rustfmt**: Rust 코드 포맷팅 도구

### 사용 방법

```bash
# 모든 린팅 실행
pnpm lint

# JavaScript/TypeScript 린팅만 실행
pnpm lint:js

# Rust 린팅만 실행
pnpm lint:rust

# Rust 코드 포맷팅
pnpm format:rust

# 모든 포맷팅 실행
pnpm format
```

Git 커밋 전에 자동으로 린팅이 실행됩니다. 문제가 있는 코드는 커밋되지 않습니다.

## 라이선스

MIT
