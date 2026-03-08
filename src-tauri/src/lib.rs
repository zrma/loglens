use std::path::PathBuf;

use tauri_plugin_fs::FsExt;

#[tauri::command]
fn allow_file_access(app: tauri::AppHandle, path: String) -> Result<(), String> {
    app.fs_scope()
        .allow_file(PathBuf::from(path))
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
