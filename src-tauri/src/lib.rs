use std::path::PathBuf;

use tauri_plugin_fs::FsExt;

fn resolve_allowed_file_path(path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();

    if trimmed.is_empty() {
        return Err("허용할 파일 경로가 비어 있습니다.".to_string());
    }

    let canonical_path = PathBuf::from(trimmed)
        .canonicalize()
        .map_err(|error| format!("파일 경로를 확인하지 못했습니다: {error}"))?;

    if !canonical_path.is_file() {
        return Err(format!(
            "일반 파일만 허용할 수 있습니다: {}",
            canonical_path.display()
        ));
    }

    Ok(canonical_path)
}

#[tauri::command]
fn allow_file_access(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let resolved_path = resolve_allowed_file_path(&path)?;

    app.fs_scope()
        .allow_file(resolved_path)
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![allow_file_access])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use std::{env, fs};

    use super::resolve_allowed_file_path;

    #[test]
    fn allow_file_access_resolves_regular_files_only() {
        let path = env::temp_dir().join(format!(
            "loglens-allow-file-access-{}.log",
            std::process::id()
        ));
        fs::write(&path, "2026-03-08T10:00:00Z ok").expect("write temp log");

        let resolved_path =
            resolve_allowed_file_path(path.to_str().expect("temp path is utf8")).expect("resolve");

        assert!(resolved_path.is_absolute());
        assert!(resolved_path.is_file());

        fs::remove_file(path).expect("remove temp log");
    }

    #[test]
    fn allow_file_access_rejects_directories() {
        let error = resolve_allowed_file_path(
            env::temp_dir()
                .to_str()
                .expect("temp directory path is utf8"),
        )
        .expect_err("directories must be rejected");

        assert!(error.contains("일반 파일만 허용"));
    }

    #[test]
    fn allow_file_access_rejects_empty_paths() {
        let error = resolve_allowed_file_path("  ").expect_err("empty paths must be rejected");

        assert!(error.contains("비어 있습니다"));
    }
}
