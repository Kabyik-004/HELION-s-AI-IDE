//! Secure credential storage via OS keychain.
//!
//! Uses the `keyring` crate which provides cross-platform access to:
//! - Windows: Credential Manager
//! - macOS: Keychain
//! - Linux: Secret Service (libsecret)

use keyring::Entry;
use serde::Serialize;
use tauri::State;

use crate::workspace::{FsError, FsErrorCode};

/// The canonical key prefix for ForgeAI credentials.
const KEY_PREFIX: &str = "forgeai";

/// Error codes for credential operations.
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CredentialErrorCode {
    /// No workspace is open.
    NoWorkspace,
    /// The credential does not exist.
    NotFound,
    /// The credential already exists.
    AlreadyExists,
    /// The OS keychain reported an error.
    KeyringError,
    /// Internal error.
    Internal,
}

/// A serialisable error for credential operations.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialError {
    pub code: CredentialErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

impl CredentialError {
    fn new(code: CredentialErrorCode, message: impl Into<String>) -> Self {
        Self { code, message: message.into(), detail: None }
    }

    fn with_detail(code: CredentialErrorCode, message: impl Into<String>, detail: impl Into<String>) -> Self {
        Self { code, message: message.into(), detail: Some(detail.into()) }
    }

    fn keyring_error(operation: &str, error: &keyring::Error) -> Self {
        let (code, message) = match error {
            keyring::Error::NoEntry => (CredentialErrorCode::NotFound, "Credential not found."),
            _ => (CredentialErrorCode::KeyringError, "The OS keychain reported an error."),
        };
        Self::with_detail(code, format!("Could not {operation} credential."), format!("{error}"))
    }
}

type CredResult<T> = Result<T, CredentialError>;

/// Builds the canonical keyring entry name for a credential.
fn entry_name(id: &str) -> String {
    format!("{KEY_PREFIX}:{id}")
}

/// Stores a secret in the OS keychain.
#[tauri::command]
pub fn set_secret(state: State<'_, crate::workspace::WorkspaceState>, id: String, secret: String) -> CredResult<()> {
    let root = {
        let guard = state.0.lock().expect("workspace mutex poisoned");
        guard.clone().ok_or_else(|| CredentialError::new(CredentialErrorCode::NoWorkspace, "No folder is open."))?
    };

    let entry = Entry::new(&format!("{}:{}", root.display(), entry_name(&id)), "")
        .map_err(|e| CredentialError::with_detail(CredentialErrorCode::Internal, "Could not create keyring entry.", format!("{e}")))?;

    entry.set_password(&secret).map_err(|e| CredentialError::keyring_error("store", &e))
}

/// Retrieves a secret from the OS keychain.
#[tauri::command]
pub fn get_secret(state: State<'_, crate::workspace::WorkspaceState>, id: String) -> CredResult<String> {
    let root = {
        let guard = state.0.lock().expect("workspace mutex poisoned");
        guard.clone().ok_or_else(|| CredentialError::new(CredentialErrorCode::NoWorkspace, "No folder is open."))?
    };

    let entry = Entry::new(&format!("{}:{}", root.display(), entry_name(&id)), "")
        .map_err(|e| CredentialError::with_detail(CredentialErrorCode::Internal, "Could not create keyring entry.", format!("{e}")))?;

    entry.get_password().map_err(|e| CredentialError::keyring_error("retrieve", &e))
}

/// Checks if a secret exists in the OS keychain.
#[tauri::command]
pub fn has_secret(state: State<'_, crate::workspace::WorkspaceState>, id: String) -> CredResult<bool> {
    let root = {
        let guard = state.0.lock().expect("workspace mutex poisoned");
        guard.clone().ok_or_else(|| CredentialError::new(CredentialErrorCode::NoWorkspace, "No folder is open."))?
    };

    let entry = Entry::new(&format!("{}:{}", root.display(), entry_name(&id)), "")
        .map_err(|e| CredentialError::with_detail(CredentialErrorCode::Internal, "Could not create keyring entry.", format!("{e}")))?;

    // Try to get the password; if it exists, the secret exists.
    match entry.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(CredentialError::keyring_error("check", &e)),
    }
}

/// Deletes a secret from the OS keychain.
#[tauri::command]
pub fn delete_secret(state: State<'_, crate::workspace::WorkspaceState>, id: String) -> CredResult<()> {
    let root = {
        let guard = state.0.lock().expect("workspace mutex poisoned");
        guard.clone().ok_or_else(|| CredentialError::new(CredentialErrorCode::NoWorkspace, "No folder is open."))?
    };

    let entry = Entry::new(&format!("{}:{}", root.display(), entry_name(&id)), "")
        .map_err(|e| CredentialError::with_detail(CredentialErrorCode::Internal, "Could not create keyring entry.", format!("{e}")))?;

    entry.delete_password().map_err(|e| CredentialError::keyring_error("delete", &e))
}