//! Workspace-confined file system access.
//!
//! # Security model
//!
//! The renderer never sends an absolute path. Every command takes a **workspace-relative**
//! path, which this module resolves against the currently open workspace root:
//!
//! ```text
//! renderer ──relative path──▶ resolve_relative ──▶ absolute path inside the workspace
//! ```
//!
//! A relative path is rejected outright when it is absolute, contains a `..` component, or
//! carries a Windows drive/UNC prefix. Paths that already exist are additionally canonicalised
//! and re-checked against the canonical root, which is what stops a symlink inside the
//! workspace from pointing outside it.
//!
//! The core operations are free functions over `root: &Path` so they can be unit-tested
//! against a real temporary directory; the `#[tauri::command]` wrappers only fetch the root.

use std::fs;
use std::io::{self, Read, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;

use serde::Serialize;
use tauri::State;

/// Files larger than this are reported as `tooLarge` instead of being loaded.
const MAX_FILE_BYTES: u64 = 4 * 1024 * 1024;
/// Directories stop being listed after this many entries.
const MAX_DIRECTORY_ENTRIES: usize = 2_000;
/// A NUL byte within this prefix marks a file as binary.
const BINARY_SNIFF_BYTES: usize = 8_000;
/// Search guards, so a walk of a huge tree cannot run away.
const MAX_SEARCH_RESULTS: usize = 200;
const MAX_SEARCH_VISITED: usize = 20_000;
const MAX_SEARCH_DEPTH: usize = 16;

/* ------------------------------------------------------------------------------- errors -- */

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum FsErrorCode {
    /// No workspace is open.
    NoWorkspace,
    /// The path escapes the workspace (traversal, absolute path, or symlink).
    OutsideWorkspace,
    /// The path is malformed.
    InvalidPath,
    /// The name is not a legal file name on this platform.
    InvalidName,
    NotFound,
    AlreadyExists,
    PermissionDenied,
    NotADirectory,
    /// The operation is not valid for a directory (for example writing over one).
    IsADirectory,
    /// The target is the workspace root, which may not be renamed or deleted.
    WorkspaceRoot,
    Io,
}

/// A serialisable error. The renderer shows `message`; `detail` is for developers.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsError {
    pub code: FsErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

impl FsError {
    pub(crate) fn new(code: FsErrorCode, message: impl Into<String>) -> Self {
        Self { code, message: message.into(), detail: None }
    }

    pub(crate) fn with_detail(code: FsErrorCode, message: impl Into<String>, detail: impl Into<String>) -> Self {
        Self { code, message: message.into(), detail: Some(detail.into()) }
    }

    fn no_workspace() -> Self {
        Self::new(FsErrorCode::NoWorkspace, "No folder is open. Open a folder to browse its files.")
    }

    fn outside(path: &str) -> Self {
        Self::with_detail(
            FsErrorCode::OutsideWorkspace,
            "That path is outside the open folder, so ForgeAI refused it.",
            format!("rejected path: {path}"),
        )
    }

    fn invalid_path(path: &str, why: &str) -> Self {
        Self::with_detail(
            FsErrorCode::InvalidPath,
            "That path is not valid.",
            format!("{why}: {path}"),
        )
    }

    fn invalid_name(name: &str, why: &str) -> Self {
        Self::with_detail(
            FsErrorCode::InvalidName,
            format!("\u{201c}{name}\u{201d} is not a valid file name."),
            why.to_string(),
        )
    }

    fn io(path: &Path, error: &io::Error) -> Self {
        let code = match error.kind() {
            io::ErrorKind::NotFound => FsErrorCode::NotFound,
            io::ErrorKind::PermissionDenied => FsErrorCode::PermissionDenied,
            io::ErrorKind::AlreadyExists => FsErrorCode::AlreadyExists,
            _ => FsErrorCode::Io,
        };
        let friendly = match code {
            FsErrorCode::NotFound => "That file or folder no longer exists.",
            FsErrorCode::PermissionDenied => "Permission denied by the operating system.",
            FsErrorCode::AlreadyExists => "Something with that name already exists.",
            _ => "The operating system reported an error.",
        };
        Self::with_detail(code, friendly, format!("{}: {}", path.display(), error))
    }
}

type FsResult<T> = Result<T, FsError>;

/* --------------------------------------------------------------------------------- dtos -- */

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum EntryKindPayload {
    File,
    Directory,
    Symlink,
    Other,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntryPayload {
    pub name: String,
    /// Workspace-relative, `/`-separated.
    pub path: String,
    pub kind: EntryKindPayload,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryListing {
    pub path: String,
    pub entries: Vec<DirEntryPayload>,
    pub truncated: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum FileContentPayload {
    Text { text: String, size: u64 },
    Binary { size: u64 },
    TooLarge { size: u64, limit: u64 },
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStatPayload {
    pub path: String,
    pub kind: EntryKindPayload,
    pub size: u64,
    /// Unix epoch milliseconds.
    pub modified_at: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceInfo {
    /// Display path of the workspace root (no Windows verbatim prefix).
    pub path: String,
    pub name: String,
}

/* -------------------------------------------------------------------------- path security */

/// Rejects anything that could escape the workspace, returning a workspace-relative path.
fn resolve_relative(root: &Path, relative: &str) -> FsResult<PathBuf> {
    let trimmed = relative.trim();
    if trimmed.is_empty() {
        return Err(FsError::invalid_path(relative, "empty path"));
    }

    let candidate = Path::new(trimmed);
    if candidate.is_absolute() {
        return Err(FsError::outside(relative));
    }

    // Walk the components explicitly: this is where `..`, drive prefixes and UNC roots are
    // rejected, rather than trying to pattern-match the string.
    let mut resolved = root.to_path_buf();
    for component in candidate.components() {
        match component {
            Component::Normal(name) => resolved.push(name),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(FsError::outside(relative));
            }
        }
    }
    Ok(resolved)
}

/// Resolves a path that must already exist, and confirms it is still inside the workspace after
/// canonicalisation (which resolves symlinks).
fn resolve_existing(root: &Path, relative: &str) -> FsResult<PathBuf> {
    let resolved = resolve_relative(root, relative)?;
    let canonical = fs::canonicalize(&resolved).map_err(|error| FsError::io(&resolved, &error))?;
    if !canonical.starts_with(root) {
        return Err(FsError::outside(relative));
    }
    Ok(canonical)
}

/// Resolves a path that is about to be created: the parent must exist and be inside the
/// workspace, and the final component must be a single legal name.
fn resolve_for_create(root: &Path, relative: &str) -> FsResult<PathBuf> {
    let resolved = resolve_relative(root, relative)?;
    if resolved == root {
        return Err(FsError::new(
            FsErrorCode::WorkspaceRoot,
            "The open folder itself cannot be changed.",
        ));
    }
    let name = resolved
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| FsError::invalid_path(relative, "missing file name"))?;
    validate_name(name)?;

    let parent = resolved
        .parent()
        .ok_or_else(|| FsError::invalid_path(relative, "missing parent directory"))?;
    let canonical_parent = fs::canonicalize(parent).map_err(|error| FsError::io(parent, &error))?;
    if !canonical_parent.starts_with(root) {
        return Err(FsError::outside(relative));
    }
    Ok(canonical_parent.join(name))
}

/// Rejects names that are illegal on Windows, plus the reserved device names. Applied on every
/// platform so a project created on Linux still opens correctly on Windows.
pub fn validate_name(name: &str) -> FsResult<()> {
    if name.is_empty() {
        return Err(FsError::invalid_name(name, "name is empty"));
    }
    if name == "." || name == ".." {
        return Err(FsError::invalid_name(name, "reserved name"));
    }
    if name.contains(|c: char| c.is_control()) {
        return Err(FsError::invalid_name(name, "name contains control characters"));
    }
    const ILLEGAL: [char; 9] = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
    if let Some(bad) = name.chars().find(|c| ILLEGAL.contains(c)) {
        return Err(FsError::invalid_name(name, &format!("name contains illegal character {bad:?}")));
    }
    if name.ends_with('.') || name.ends_with(' ') {
        return Err(FsError::invalid_name(name, "name may not end with a dot or space"));
    }
    let stem = name.split('.').next().unwrap_or(name).to_ascii_uppercase();
    const RESERVED: [&str; 22] = [
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
        "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];
    if RESERVED.contains(&stem.as_str()) {
        return Err(FsError::invalid_name(name, "name is reserved by the operating system"));
    }
    Ok(())
}

/// Workspace-relative, `/`-separated path for display and for the IPC boundary.
///
/// The workspace root itself is reported as `"."`, matching the value the frontend uses, so both
/// sides speak one vocabulary for "the folder I opened".
fn to_relative(root: &Path, path: &Path) -> String {
    let relative = path
        .strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/");
    if relative.is_empty() {
        ".".to_string()
    } else {
        relative
    }
}

fn join_relative(parent: &str, name: &str) -> String {
    if parent.is_empty() || parent == "." {
        name.to_string()
    } else {
        format!("{parent}/{name}")
    }
}

/// Strips the Windows verbatim prefix (`\\?\`) so paths can be shown to a developer.
pub fn display_string(path: &Path) -> String {
    let text = path.to_string_lossy().to_string();
    #[cfg(windows)]
    {
        if let Some(rest) = text.strip_prefix(r"\\?\UNC\") {
            return format!(r"\\{rest}");
        }
        if let Some(rest) = text.strip_prefix(r"\\?\") {
            return rest.to_string();
        }
    }
    text
}

/* ------------------------------------------------------------------------ core operations */

fn entry_kind(file_type: fs::FileType) -> EntryKindPayload {
    if file_type.is_symlink() {
        EntryKindPayload::Symlink
    } else if file_type.is_dir() {
        EntryKindPayload::Directory
    } else if file_type.is_file() {
        EntryKindPayload::File
    } else {
        EntryKindPayload::Other
    }
}

pub fn read_directory_in(root: &Path, relative: &str, show_hidden: bool) -> FsResult<DirectoryListing> {
    let directory = resolve_existing(root, relative)?;
    if !directory.is_dir() {
        return Err(FsError::new(FsErrorCode::NotADirectory, "That path is not a folder."));
    }

    let read = fs::read_dir(&directory).map_err(|error| FsError::io(&directory, &error))?;
    let mut entries = Vec::new();
    let mut truncated = false;

    for item in read {
        let item = match item {
            Ok(value) => value,
            // A single unreadable entry must not fail the whole listing.
            Err(_) => continue,
        };
        let name = item.file_name().to_string_lossy().to_string();
        if !show_hidden && name.starts_with('.') {
            continue;
        }
        let file_type = match item.file_type() {
            Ok(value) => value,
            Err(_) => continue,
        };
        if entries.len() >= MAX_DIRECTORY_ENTRIES {
            truncated = true;
            break;
        }
        let parent_relative = to_relative(root, &directory);
        entries.push(DirEntryPayload {
            path: join_relative(&parent_relative, &name),
            name,
            kind: entry_kind(file_type),
        });
    }

    // Directories first, then case-insensitive by name: the order a developer expects.
    entries.sort_by(|a, b| {
        let a_dir = matches!(a.kind, EntryKindPayload::Directory);
        let b_dir = matches!(b.kind, EntryKindPayload::Directory);
        b_dir.cmp(&a_dir).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(DirectoryListing { path: to_relative(root, &directory), entries, truncated })
}

pub fn read_file_in(root: &Path, relative: &str) -> FsResult<FileContentPayload> {
    let path = resolve_existing(root, relative)?;
    let metadata = fs::metadata(&path).map_err(|error| FsError::io(&path, &error))?;
    if metadata.is_dir() {
        return Err(FsError::new(FsErrorCode::IsADirectory, "That path is a folder, not a file."));
    }

    let size = metadata.len();
    if size > MAX_FILE_BYTES {
        return Ok(FileContentPayload::TooLarge { size, limit: MAX_FILE_BYTES });
    }

    let mut file = fs::File::open(&path).map_err(|error| FsError::io(&path, &error))?;
    let mut buffer = Vec::with_capacity(size as usize);
    file.read_to_end(&mut buffer).map_err(|error| FsError::io(&path, &error))?;

    let sniff = &buffer[..buffer.len().min(BINARY_SNIFF_BYTES)];
    if sniff.contains(&0) {
        return Ok(FileContentPayload::Binary { size });
    }
    match String::from_utf8(buffer) {
        // Non-UTF-8 content is reported as binary rather than mangled on the next save.
        Ok(text) => Ok(FileContentPayload::Text { text, size }),
        Err(_) => Ok(FileContentPayload::Binary { size }),
    }
}

pub fn write_file_in(root: &Path, relative: &str, contents: &str) -> FsResult<()> {
    let path = resolve_existing(root, relative)?;
    if path.is_dir() {
        return Err(FsError::new(FsErrorCode::IsADirectory, "That path is a folder, not a file."));
    }
    fs::write(&path, contents).map_err(|error| FsError::io(&path, &error))
}

pub fn create_file_in(root: &Path, relative: &str, contents: Option<&str>) -> FsResult<()> {
    let path = resolve_for_create(root, relative)?;
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .map_err(|error| FsError::io(&path, &error))?;
    if let Some(text) = contents {
        file.write_all(text.as_bytes()).map_err(|error| FsError::io(&path, &error))?;
    }
    Ok(())
}

pub fn create_directory_in(root: &Path, relative: &str) -> FsResult<()> {
    let path = resolve_for_create(root, relative)?;
    fs::create_dir(&path).map_err(|error| FsError::io(&path, &error))
}

pub fn rename_in(root: &Path, from: &str, to: &str) -> FsResult<()> {
    let source = resolve_existing(root, from)?;
    if source == root {
        return Err(FsError::new(FsErrorCode::WorkspaceRoot, "The open folder itself cannot be renamed."));
    }
    let destination = resolve_for_create(root, to)?;
    if destination.exists() {
        return Err(FsError::new(
            FsErrorCode::AlreadyExists,
            "Something with that name already exists in the destination folder.",
        ));
    }
    fs::rename(&source, &destination).map_err(|error| FsError::io(&source, &error))
}

pub fn delete_in(root: &Path, relative: &str, recursive: bool) -> FsResult<()> {
    let path = resolve_existing(root, relative)?;
    if path == root {
        return Err(FsError::new(FsErrorCode::WorkspaceRoot, "The open folder itself cannot be deleted."));
    }
    let metadata = fs::metadata(&path).map_err(|error| FsError::io(&path, &error))?;
    if metadata.is_dir() {
        // Never delete a directory's contents unless the caller explicitly asked for it.
        let result = if recursive { fs::remove_dir_all(&path) } else { fs::remove_dir(&path) };
        result.map_err(|error| FsError::io(&path, &error))
    } else {
        fs::remove_file(&path).map_err(|error| FsError::io(&path, &error))
    }
}

pub fn stat_in(root: &Path, relative: &str) -> FsResult<FileStatPayload> {
    let path = resolve_existing(root, relative)?;
    let metadata = fs::metadata(&path).map_err(|error| FsError::io(&path, &error))?;
    let modified_at = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0);
    let kind = if metadata.is_dir() {
        EntryKindPayload::Directory
    } else if metadata.is_file() {
        EntryKindPayload::File
    } else {
        EntryKindPayload::Other
    };
    Ok(FileStatPayload { path: to_relative(root, &path), kind, size: metadata.len(), modified_at })
}

pub fn search_in(root: &Path, pattern: &str, max_results: Option<usize>) -> FsResult<Vec<String>> {
    let needle = pattern.trim().to_lowercase();
    if needle.is_empty() {
        return Err(FsError::invalid_path(pattern, "empty search pattern"));
    }
    let limit = max_results.unwrap_or(MAX_SEARCH_RESULTS).min(MAX_SEARCH_RESULTS);

    let mut results = Vec::new();
    let mut visited = 0usize;
    let mut stack = vec![(root.to_path_buf(), 0usize)];

    while let Some((directory, depth)) = stack.pop() {
        if depth > MAX_SEARCH_DEPTH || visited > MAX_SEARCH_VISITED || results.len() >= limit {
            break;
        }
        let read = match fs::read_dir(&directory) {
            Ok(value) => value,
            Err(_) => continue,
        };
        for item in read.flatten() {
            visited += 1;
            let name = item.file_name().to_string_lossy().to_string();
            // `.git` and friends are noise for a name search.
            if name.starts_with('.') {
                continue;
            }
            let is_dir = item.file_type().map(|t| t.is_dir()).unwrap_or(false);
            if is_dir {
                stack.push((item.path(), depth + 1));
            } else if name.to_lowercase().contains(&needle) {
                results.push(to_relative(root, &item.path()));
                if results.len() >= limit {
                    break;
                }
            }
        }
    }
    Ok(results)
}

/* --------------------------------------------------------------------------- tauri state -- */

/// The currently open workspace root (canonical), or `None`.
#[derive(Default)]
pub struct WorkspaceState(pub Mutex<Option<PathBuf>>);

fn root_of(state: &State<'_, WorkspaceState>) -> FsResult<PathBuf> {
    state
        .0
        .lock()
        .expect("workspace mutex poisoned")
        .clone()
        .ok_or_else(FsError::no_workspace)
}

/* ------------------------------------------------------------------------------ commands -- */

#[tauri::command]
pub fn open_workspace(state: State<'_, WorkspaceState>, path: String) -> FsResult<WorkspaceInfo> {
    let requested = PathBuf::from(&path);
    if !requested.is_dir() {
        return Err(FsError::with_detail(
            FsErrorCode::NotADirectory,
            "That is not a folder.",
            format!("not a directory: {path}"),
        ));
    }
    let canonical = fs::canonicalize(&requested).map_err(|error| FsError::io(&requested, &error))?;
    let display = display_string(&canonical);
    let name = canonical
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| display.clone());

    *state.0.lock().expect("workspace mutex poisoned") = Some(canonical);
    Ok(WorkspaceInfo { path: display, name })
}

#[tauri::command]
pub fn current_workspace(state: State<'_, WorkspaceState>) -> Option<WorkspaceInfo> {
    let guard = state.0.lock().expect("workspace mutex poisoned");
    guard.as_ref().map(|root| {
        let display = display_string(root);
        let name = root
            .file_name()
            .map(|value| value.to_string_lossy().to_string())
            .unwrap_or_else(|| display.clone());
        WorkspaceInfo { path: display, name }
    })
}

#[tauri::command]
pub fn close_workspace(state: State<'_, WorkspaceState>) {
    *state.0.lock().expect("workspace mutex poisoned") = None;
}

#[tauri::command]
pub fn read_directory(
    state: State<'_, WorkspaceState>,
    path: String,
    show_hidden: bool,
) -> FsResult<DirectoryListing> {
    read_directory_in(&root_of(&state)?, &path, show_hidden)
}

#[tauri::command]
pub fn read_file(state: State<'_, WorkspaceState>, path: String) -> FsResult<FileContentPayload> {
    read_file_in(&root_of(&state)?, &path)
}

#[tauri::command]
pub fn write_file(state: State<'_, WorkspaceState>, path: String, contents: String) -> FsResult<()> {
    write_file_in(&root_of(&state)?, &path, &contents)
}

#[tauri::command]
pub fn create_file(
    state: State<'_, WorkspaceState>,
    path: String,
    contents: Option<String>,
) -> FsResult<()> {
    create_file_in(&root_of(&state)?, &path, contents.as_deref())
}

#[tauri::command]
pub fn create_directory(state: State<'_, WorkspaceState>, path: String) -> FsResult<()> {
    create_directory_in(&root_of(&state)?, &path)
}

#[tauri::command]
pub fn rename_path(state: State<'_, WorkspaceState>, from: String, to: String) -> FsResult<()> {
    rename_in(&root_of(&state)?, &from, &to)
}

#[tauri::command]
pub fn delete_path(state: State<'_, WorkspaceState>, path: String, recursive: bool) -> FsResult<()> {
    delete_in(&root_of(&state)?, &path, recursive)
}

#[tauri::command]
pub fn stat_path(state: State<'_, WorkspaceState>, path: String) -> FsResult<FileStatPayload> {
    stat_in(&root_of(&state)?, &path)
}

#[tauri::command]
pub fn path_exists(state: State<'_, WorkspaceState>, path: String) -> FsResult<bool> {
    let root = root_of(&state)?;
    match resolve_relative(&root, &path) {
        Ok(resolved) => Ok(resolved.exists()),
        // An out-of-workspace path is a refusal, not a "does not exist".
        Err(error) => Err(error),
    }
}

#[tauri::command]
pub fn search_paths(
    state: State<'_, WorkspaceState>,
    pattern: String,
    max_results: Option<usize>,
) -> FsResult<Vec<String>> {
    search_in(&root_of(&state)?, &pattern, max_results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs as stdfs;

    fn workspace() -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().expect("temp dir");
        let root = stdfs::canonicalize(dir.path()).expect("canonical root");
        (dir, root)
    }

    #[test]
    fn rejects_parent_traversal() {
        let (_dir, root) = workspace();
        let error = resolve_relative(&root, "../secrets.txt").unwrap_err();
        assert!(matches!(error.code, FsErrorCode::OutsideWorkspace));
        let error = resolve_relative(&root, "a/../../b").unwrap_err();
        assert!(matches!(error.code, FsErrorCode::OutsideWorkspace));
    }

    #[test]
    fn rejects_empty_and_curdir_only_paths_are_allowed() {
        let (_dir, root) = workspace();
        assert!(resolve_relative(&root, "").is_err());
        assert!(resolve_relative(&root, "   ").is_err());
        // "." resolves to the root, which is legitimate for listing.
        assert_eq!(resolve_relative(&root, ".").unwrap(), root);
    }

    #[test]
    #[cfg(windows)]
    fn rejects_absolute_and_prefixed_paths() {
        let (_dir, root) = workspace();
        assert!(matches!(
            resolve_relative(&root, r"C:\Windows\System32").unwrap_err().code,
            FsErrorCode::OutsideWorkspace
        ));
        assert!(matches!(
            resolve_relative(&root, r"\\server\share").unwrap_err().code,
            FsErrorCode::OutsideWorkspace
        ));
    }

    #[test]
    fn rejects_symlink_that_escapes_the_workspace() {
        let (_dir, root) = workspace();
        let outside = tempfile::tempdir().expect("outside dir");
        stdfs::write(outside.path().join("secret.txt"), "classified").unwrap();

        #[cfg(unix)]
        let linked = std::os::unix::fs::symlink(outside.path(), root.join("link")).is_ok();
        #[cfg(windows)]
        let linked = std::os::windows::fs::symlink_dir(outside.path(), root.join("link")).is_ok();

        if !linked {
            // Creating symlinks needs privileges on Windows; nothing to assert if denied.
            return;
        }
        let error = read_file_in(&root, "link/secret.txt").unwrap_err();
        assert!(matches!(error.code, FsErrorCode::OutsideWorkspace), "escaped via symlink");
    }

    #[test]
    fn round_trips_create_read_write_rename_delete() {
        let (_dir, root) = workspace();

        create_directory_in(&root, "src").unwrap();
        create_file_in(&root, "src/app.ts", Some("let x = 1;")).unwrap();

        match read_file_in(&root, "src/app.ts").unwrap() {
            FileContentPayload::Text { text, size } => {
                assert_eq!(text, "let x = 1;");
                assert_eq!(size, 10);
            }
            other => panic!("expected text, got {other:?}"),
        }

        write_file_in(&root, "src/app.ts", "let x = 2;").unwrap();
        match read_file_in(&root, "src/app.ts").unwrap() {
            FileContentPayload::Text { text, .. } => assert_eq!(text, "let x = 2;"),
            other => panic!("expected text, got {other:?}"),
        }

        rename_in(&root, "src/app.ts", "src/main.ts").unwrap();
        assert!(!root.join("src/app.ts").exists());
        assert!(root.join("src/main.ts").exists());

        delete_in(&root, "src/main.ts", false).unwrap();
        assert!(!root.join("src/main.ts").exists());
    }

    #[test]
    fn create_refuses_to_overwrite_and_rejects_bad_names() {
        let (_dir, root) = workspace();
        create_file_in(&root, "a.txt", None).unwrap();
        assert!(matches!(
            create_file_in(&root, "a.txt", None).unwrap_err().code,
            FsErrorCode::AlreadyExists
        ));
        assert!(matches!(
            create_file_in(&root, "bad:name.txt", None).unwrap_err().code,
            FsErrorCode::InvalidName
        ));
        assert!(matches!(
            create_file_in(&root, "nested/deep.txt", None).unwrap_err().code,
            FsErrorCode::NotFound
        ));
    }

    #[test]
    fn delete_refuses_the_workspace_root_and_non_empty_directories() {
        let (_dir, root) = workspace();
        create_directory_in(&root, "keep").unwrap();
        create_file_in(&root, "keep/inside.txt", None).unwrap();

        assert!(matches!(delete_in(&root, "keep", false).unwrap_err().code, FsErrorCode::Io));
        assert!(root.join("keep").exists());

        delete_in(&root, "keep", true).unwrap();
        assert!(!root.join("keep").exists());

        // "." resolves to the root and must never be deletable.
        assert!(matches!(delete_in(&root, ".", true).unwrap_err().code, FsErrorCode::WorkspaceRoot));
        assert!(root.exists());
    }

    #[test]
    fn rename_refuses_existing_destination_and_root() {
        let (_dir, root) = workspace();
        create_file_in(&root, "one.txt", None).unwrap();
        create_file_in(&root, "two.txt", None).unwrap();
        assert!(matches!(
            rename_in(&root, "one.txt", "two.txt").unwrap_err().code,
            FsErrorCode::AlreadyExists
        ));
        assert!(matches!(rename_in(&root, "one.txt", ".").unwrap_err().code, FsErrorCode::WorkspaceRoot));
    }

    #[test]
    fn reports_binary_and_oversized_files_instead_of_loading_them() {
        let (_dir, root) = workspace();
        stdfs::write(root.join("blob.bin"), [0u8, 159, 146, 150, 0u8, 1u8]).unwrap();
        assert!(matches!(
            read_file_in(&root, "blob.bin").unwrap(),
            FileContentPayload::Binary { .. }
        ));

        let big = vec![b'a'; (MAX_FILE_BYTES + 1) as usize];
        stdfs::write(root.join("big.txt"), &big).unwrap();
        match read_file_in(&root, "big.txt").unwrap() {
            FileContentPayload::TooLarge { limit, .. } => assert_eq!(limit, MAX_FILE_BYTES),
            other => panic!("expected tooLarge, got {other:?}"),
        }
    }

    #[test]
    fn directory_listing_hides_dotfiles_on_request_and_sorts_directories_first() {
        let (_dir, root) = workspace();
        create_directory_in(&root, "zdir").unwrap();
        create_file_in(&root, "afile.txt", None).unwrap();
        create_file_in(&root, ".hidden", None).unwrap();

        let all = read_directory_in(&root, ".", true).unwrap();
        let names: Vec<&str> = all.entries.iter().map(|e| e.name.as_str()).collect();
        // Directories first, then case-insensitive by name — "." sorts before letters.
        assert_eq!(names, vec!["zdir", ".hidden", "afile.txt"]);
        assert!(!all.truncated);

        let visible = read_directory_in(&root, ".", false).unwrap();
        let names: Vec<&str> = visible.entries.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, vec!["zdir", "afile.txt"]);
    }

    #[test]
    fn search_matches_file_names_within_the_workspace() {
        let (_dir, root) = workspace();
        create_directory_in(&root, "src").unwrap();
        create_file_in(&root, "src/app.ts", None).unwrap();
        create_file_in(&root, "src/other.rs", None).unwrap();

        let hits = search_in(&root, "app", None).unwrap();
        assert_eq!(hits, vec!["src/app.ts"]);
        assert!(search_in(&root, "", None).is_err());
    }

    #[test]
    fn stat_reports_size_and_kind() {
        let (_dir, root) = workspace();
        create_file_in(&root, "note.txt", Some("hello")).unwrap();
        let stat = stat_in(&root, "note.txt").unwrap();
        assert_eq!(stat.size, 5);
        assert!(matches!(stat.kind, EntryKindPayload::File));
        assert!(stat.modified_at > 0);
    }

    #[test]
    fn display_string_strips_verbatim_prefix() {
        let (_dir, root) = workspace();
        let shown = display_string(&root);
        assert!(!shown.starts_with(r"\\?\"), "verbatim prefix leaked: {shown}");
    }

    #[test]
    fn an_empty_folder_lists_cleanly() {
        let (_dir, root) = workspace();
        let listing = read_directory_in(&root, ".", true).unwrap();
        assert!(listing.entries.is_empty());
        assert!(!listing.truncated);
        assert_eq!(listing.path, ".");
    }

    #[test]
    fn walks_a_nested_project_one_level_at_a_time() {
        let (_dir, root) = workspace();
        create_directory_in(&root, "src").unwrap();
        create_directory_in(&root, "src/components").unwrap();
        create_file_in(&root, "src/components/Button.tsx", Some("export {};")).unwrap();
        create_file_in(&root, "src/App.tsx", Some("export {};")).unwrap();

        // Root: only `src`.
        let top = read_directory_in(&root, ".", true).unwrap();
        assert_eq!(top.entries.iter().map(|e| e.name.as_str()).collect::<Vec<_>>(), vec!["src"]);

        // One level down: the folder and the file, folder first.
        let src = read_directory_in(&root, "src", true).unwrap();
        assert_eq!(
            src.entries.iter().map(|e| e.name.as_str()).collect::<Vec<_>>(),
            vec!["components", "App.tsx"]
        );
        assert_eq!(src.path, "src");

        // Paths returned are workspace-relative and use forward slashes.
        let deepest = read_directory_in(&root, "src/components", true).unwrap();
        assert_eq!(deepest.entries[0].path, "src/components/Button.tsx");

        match read_file_in(&root, "src/components/Button.tsx").unwrap() {
            FileContentPayload::Text { text, .. } => assert_eq!(text, "export {};"),
            other => panic!("expected text, got {other:?}"),
        }
    }

    #[test]
    fn renaming_a_directory_moves_its_contents() {
        let (_dir, root) = workspace();
        create_directory_in(&root, "src").unwrap();
        create_file_in(&root, "src/App.tsx", Some("original")).unwrap();

        rename_in(&root, "src", "lib").unwrap();

        assert!(!root.join("src").exists());
        // The child moved with its parent and is still readable under the new path.
        match read_file_in(&root, "lib/App.tsx").unwrap() {
            FileContentPayload::Text { text, .. } => assert_eq!(text, "original"),
            other => panic!("expected text, got {other:?}"),
        }
        // The old path is gone.
        assert!(matches!(read_file_in(&root, "src/App.tsx").unwrap_err().code, FsErrorCode::NotFound));
    }
}
