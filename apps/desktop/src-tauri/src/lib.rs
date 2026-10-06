//! ForgeAI's Tauri backend.
//!
//! # Scope in Module 0
//!
//! This crate is deliberately tiny. It starts the application window and exposes **one**
//! command, [`app_info`], so the frontend can prove the IPC bridge works.
//!
//! It exposes no file system access, no shell, and no credential access. Those capabilities are
//! added in later modules, each with its own entry in `capabilities/`, so that the set of
//! things the frontend may ask the backend to do is always a reviewable, explicit list.

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
    AppInfo {
        name: "ForgeAI".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

/// Builds and runs the Tauri application.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Commands are registered explicitly; there is no catch-all dispatcher.
        .invoke_handler(tauri::generate_handler![app_info])
        .run(tauri::generate_context!())
        .expect("error while running ForgeAI");
}
