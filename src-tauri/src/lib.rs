// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri_plugin_fs::FsExt;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // 파일 시스템 접근 권한 설정
            let fs_scope = app.fs_scope();
            if let Err(e) = fs_scope.allow_directory("/", true) {
                eprintln!("Failed to allow directory access: {}", e);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
