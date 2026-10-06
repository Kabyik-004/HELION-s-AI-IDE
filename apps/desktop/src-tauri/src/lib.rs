//! ForgeAI's Tauri backend.
//!
//! # Scope today (Module 2)
//!
//! The backend exposes exactly two capabilities, each deliberately narrow:
//!
//! - **Workspace file access** ([`workspace`]) — read, create, rename and delete files inside
//!   the folder the user opened. Every path crossing the IPC boundary is workspace-relative and
//!   is rejected if it escapes the workspace, so the renderer can never reach the wider machine.
//! - **Preference storage** ([`app_state`]) — a single JSON file in the application config
//!   directory. Secrets never pass through it.
//!
//! It still exposes **no shell, no process execution and no credential access**. Those arrive in
//! later modules, each with its own entry in `capabilities/`, so the set of things the frontend
//! may ask the backend to do stays a reviewable, explicit list.

mod app_state;
mod workspace;

use serde::Serialize;

/// Non-secret application metadata surfaced to the UI.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    /// Product name.
    pub name: String,
    /// Semantic version, taken from `Cargo.toml` at compile time.
    pub version: String,
}

/// Returns the product name and version.
///
/// Used by the status bar to show that the frontend and backend are actually talking to each
/// other. It reads only compile-time constants and touches nothing outside the process.
#[tauri::command]
fn app_info() -> AppInfo {
    AppInfo { name: "ForgeAI".to_string(), version: env!("CARGO_PKG_VERSION").to_string() }
}

/// Builds and runs the Tauri application.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // The only plugin: the native folder picker. Its single permission (`dialog:allow-open`)
        // is declared in `capabilities/default.json`.
        .plugin(tauri_plugin_dialog::init())
        // Holds the currently open workspace root, shared by every file command.
        .manage(workspace::WorkspaceState::default())
        // Commands are registered explicitly; there is no catch-all dispatcher.
        .invoke_handler(tauri::generate_handler![
            app_info,
            workspace::open_workspace,
            workspace::current_workspace,
            workspace::close_workspace,
            workspace::read_directory,
            workspace::read_file,
            workspace::write_file,
            workspace::create_file,
            workspace::create_directory,
            workspace::rename_path,
            workspace::delete_path,
            workspace::stat_path,
            workspace::path_exists,
            workspace::search_paths,
            app_state::load_app_state,
            app_state::save_app_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ForgeAI");
}
