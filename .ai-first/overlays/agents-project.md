## Repository Overlay

- selected-file access scope와 parser/analysis/Tauri boundary를 유지한다.
- 기본 검증은 `pnpm check`; native surface는 `pnpm check:runtime-smoke`로 확인한다.
- 로컬 VCS는 `jj`를 사용하고 승인된 publish는 PR/CI feedback loop까지 닫는다.
