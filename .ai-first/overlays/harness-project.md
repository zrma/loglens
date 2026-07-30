## Project Overlay

- frontend file loading은 `allow_file_access` 승인 후에만 수행하고 path를 canonicalize한다.
- Tauri/Rust는 native 요구가 없는 한 얇은 desktop shell로 유지한다.
- large-log fast regression과 opt-in benchmark를 분리한다.

## Related Documents

- Operating policy: `docs/agent-operating-contract.md`, `docs/agent-autonomy-playbook.md`.
- Current state: `docs/status.md`, `docs/roadmap.md`.
- Runtime map: `docs/repository-overview.md`, `docs/log-format-support.md`.
- Completed work: `docs/completed-milestones.md`.
