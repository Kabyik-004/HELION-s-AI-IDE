//! Secure credential storage via the OS keychain.
//!
//! Uses the `keyring` crate which provides cross-platform access to:
//! - Windows: Credential Manager
//! - macOS:   Keychain
//! - Linux:   Secret Service (libsecret)
//!
//! Credentials are **application-global**, not scoped to the open folder: an API key belongs to
//! the developer, not to a project, and configuring a provider must not require a folder to be
//! open. The renderer passes only an opaque id (`provider:<instanceId>:apiKey`); the secret value
//! is never written to configuration, logs or error messages.

use keyring::Entry;
use serde::Serialize;

/// The keychain service name every ForgeAI credential is stored under.
pub(crate) const SERVICE: &str = "forgeai";

/// Error codes for credential operations.
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CredentialErrorCode {
    /// The credential does not exist.
    NotFound,
    /// The OS keychain reported an error.
    KeyringError,
}

/// A serialisable error for credential operations. `detail` is for developers and never contains
/// the secret itself.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialError {
    pub code: CredentialErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

impl CredentialError {
    fn keyring_error(operation: &str, error: &keyring::Error) -> Self {
        let code = match error {
            keyring::Error::NoEntry => CredentialErrorCode::NotFound,
            _ => CredentialErrorCode::KeyringError,
        };
        Self {
            code,
            message: format!("Could not {operation} credential."),
            detail: Some(format!("{error}")),
        }
    }
}

type CredResult<T> = Result<T, CredentialError>;

/// The keychain entry for an opaque credential id.
pub(crate) fn keyring_entry(id: &str) -> Entry {
    Entry::new(SERVICE, id)
}

/// Stores a secret in the OS keychain.
#[tauri::command]
pub fn set_secret(id: String, secret: String) -> CredResult<()> {
    keyring_entry(&id).set_password(&secret).map_err(|e| CredentialError::keyring_error("store", &e))
}

/// Retrieves a secret.
///
/// The value crosses the IPC boundary only for an operation that genuinely needs it (a provider
/// adapter, for example). There is no UI action that calls this merely to display a key.
#[tauri::command]
pub fn get_secret(id: String) -> CredResult<String> {
    keyring_entry(&id).get_password().map_err(|e| CredentialError::keyring_error("retrieve", &e))
}

/// Reports whether a secret exists, without returning it.
#[tauri::command]
pub fn has_secret(id: String) -> CredResult<bool> {
    match keyring_entry(&id).get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(CredentialError::keyring_error("check", &e)),
    }
}

/// Deletes a secret. Deleting a secret that is already absent is not an error.
#[tauri::command]
pub fn delete_secret(id: String) -> CredResult<()> {
    match keyring_entry(&id).delete_password() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(CredentialError::keyring_error("delete", &e)),
    }
}
