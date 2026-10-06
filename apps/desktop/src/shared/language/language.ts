import { baseName, extensionOf } from "../path/path";

/**
 * Maps a file path to a Monaco language id and an explorer icon tint.
 *
 * Language detection is one concern with one owner. Path parsing lives in `shared/path`; this
 * module only answers "what is this file?".
 */

interface LanguageRule {
  readonly language: string;
  /** Tailwind text-colour class used for the file's icon in the explorer. */
  readonly tint: string;
}

const RULES: Readonly<Record<string, LanguageRule>> = {
  // Web
  ts: { language: "typescript", tint: "text-info-500" },
  tsx: { language: "typescript", tint: "text-info-500" },
  mts: { language: "typescript", tint: "text-info-500" },
  cts: { language: "typescript", tint: "text-info-500" },
  js: { language: "javascript", tint: "text-warning-500" },
  jsx: { language: "javascript", tint: "text-warning-500" },
  mjs: { language: "javascript", tint: "text-warning-500" },
  cjs: { language: "javascript", tint: "text-warning-500" },
  json: { language: "json", tint: "text-warning-500" },
  jsonc: { language: "json", tint: "text-warning-500" },
  css: { language: "css", tint: "text-info-500" },
  scss: { language: "scss", tint: "text-info-500" },
  less: { language: "less", tint: "text-info-500" },
  html: { language: "html", tint: "text-danger-500" },
  htm: { language: "html", tint: "text-danger-500" },
  vue: { language: "html", tint: "text-success-500" },
  svelte: { language: "html", tint: "text-danger-500" },

  // Data / config
  svg: { language: "xml", tint: "text-success-500" },
  xml: { language: "xml", tint: "text-success-500" },
  yml: { language: "yaml", tint: "text-danger-500" },
  yaml: { language: "yaml", tint: "text-danger-500" },
  toml: { language: "ini", tint: "text-ink-300" },
  ini: { language: "ini", tint: "text-ink-300" },
  env: { language: "ini", tint: "text-success-500" },
  properties: { language: "ini", tint: "text-ink-300" },
  sql: { language: "sql", tint: "text-info-500" },

  // Documentation
  md: { language: "markdown", tint: "text-ink-300" },
  markdown: { language: "markdown", tint: "text-ink-300" },
  mdx: { language: "markdown", tint: "text-ink-300" },
  txt: { language: "plaintext", tint: "text-ink-400" },

  // Systems / backend
  rs: { language: "rust", tint: "text-accent-400" },
  go: { language: "go", tint: "text-info-500" },
  py: { language: "python", tint: "text-info-500" },
  pyw: { language: "python", tint: "text-info-500" },
  rb: { language: "ruby", tint: "text-danger-500" },
  java: { language: "java", tint: "text-danger-500" },
  kt: { language: "kotlin", tint: "text-info-500" },
  c: { language: "c", tint: "text-info-500" },
  h: { language: "c", tint: "text-info-500" },
  cpp: { language: "cpp", tint: "text-info-500" },
  cc: { language: "cpp", tint: "text-info-500" },
  cxx: { language: "cpp", tint: "text-info-500" },
  hpp: { language: "cpp", tint: "text-info-500" },
  hxx: { language: "cpp", tint: "text-info-500" },
  cs: { language: "csharp", tint: "text-success-500" },
  php: { language: "php", tint: "text-info-500" },
  swift: { language: "swift", tint: "text-danger-500" },

  // Shell
  sh: { language: "shell", tint: "text-success-500" },
  bash: { language: "shell", tint: "text-success-500" },
  zsh: { language: "shell", tint: "text-success-500" },
  ps1: { language: "powershell", tint: "text-info-500" },
  bat: { language: "bat", tint: "text-ink-300" },
  cmd: { language: "bat", tint: "text-ink-300" },
};

/** Files that carry meaning without an extension. */
const SPECIAL_NAMES: Readonly<Record<string, LanguageRule>> = {
  dockerfile: { language: "dockerfile", tint: "text-info-500" },
  "docker-compose.yml": { language: "yaml", tint: "text-danger-500" },
  makefile: { language: "plaintext", tint: "text-warning-500" },
  ".env": { language: "ini", tint: "text-success-500" },
  ".editorconfig": { language: "ini", tint: "text-ink-300" },
  ".gitignore": { language: "plaintext", tint: "text-ink-400" },
  ".dockerignore": { language: "plaintext", tint: "text-ink-400" },
  ".gitattributes": { language: "plaintext", tint: "text-ink-400" },
  ".npmrc": { language: "ini", tint: "text-ink-300" },
};

const DEFAULT_RULE: LanguageRule = { language: "plaintext", tint: "text-ink-400" };

function ruleFor(path: string): LanguageRule {
  const name = baseName(path).toLowerCase();
  const special = SPECIAL_NAMES[name];
  if (special !== undefined) return special;
  // `.env.local`, `.env.production`, ...
  if (name.startsWith(".env.")) return SPECIAL_NAMES[".env"] ?? DEFAULT_RULE;
  return RULES[extensionOf(path)] ?? DEFAULT_RULE;
}

/** Monaco language id for a path. */
export function languageForPath(path: string): string {
  return ruleFor(path).language;
}

/** Tailwind text-colour class for a path's icon. */
export function tintForPath(path: string): string {
  return ruleFor(path).tint;
}
