//! Application state persistence.
//!
//! ForgeAI stores user preferences (recent folders, selected provider and model, layout
//! preferences) in a **single JSON file** inside the platform's application config directory:
//!
//! - Windows: `%APPDATA%\dev.forgeai.desktop\state.json`
//! - macOS:   `~/Library/Application Support/dev.forgeai.desktop/state.json`
//! - Linux:   `~/.config/dev.forgeai.desktop/state.json`
//!
//! The renderer can only read and write this one file — there is no general-purpose file write
//! exposed here. Secrets never travel through it; API keys belong to the OS keychain, which is
//! a separate capability introduced later.

use std::fs;
use std::io;
use std::path::PathBuf;

use serde_json::Value;
use tauri::{AppHandle, Manager};

use crate::workspace::{FsError, FsErrorCode};

const STATE_FILE: &str = "state.json";

fn state_path(app: &AppHandle) -> Result<PathBuf, FsError> {
    let directory = app.path().app_config_dir().map_err(|error| {
        FsError::new(
            FsErrorCode::Io,
            format!("Could not locate the application configuration directory: {error}"),
        )
    })?;
    Ok(directory.join(STATE_FILE))
}

/// Reads the persisted state, or `None` when nothing has been saved yet.
///
/// A corrupt or unreadable file is treated as "no state" rather than an error: losing
/// preferences must never stop the application from starting.
#[tauri::command]
pub fn load_app_state(app: AppHandle) -> Result<Option<Value>, FsError> {
    let path = state_path(&app)?;
    match fs::read_to_string(&path) {
        Ok(text) => Ok(serde_json::from_str::<Value>(&text).ok()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(FsError::new(
            FsErrorCode::Io,
            format!("Could not read the saved settings: {error}"),
        )),
    }
}

/// Writes the persisted state.
///
/// The write goes to a temporary file which is then renamed over the real one, so an
/// interrupted write cannot leave a half-written settings file behind.
#[tauri::command]
pub fn save_app_state(app: AppHandle, value: Value) -> Result<(), FsError> {
    let path = state_path(&app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            FsError::new(FsErrorCode::Io, format!("Could not create the settings directory: {error}"))
        })?;
    }

    let text = serde_json::to_string_pretty(&value).map_err(|error| {
        FsError::new(FsErrorCode::Io, format!("Could not serialise the settings: {error}"))
    })?;

    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, text).map_err(|error| {
        FsError::new(FsErrorCode::Io, format!("Could not save settings: {error}"))
    })?;
    fs::rename(&temporary, &path).map_err(|error| {
        FsError::new(FsErrorCode::Io, format!("Could not replace the settings file: {error}"))
    })?;
    Ok(())
}
