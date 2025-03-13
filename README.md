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

## 라이선스

MIT
