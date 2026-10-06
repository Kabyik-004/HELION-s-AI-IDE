import { FileSystemError } from "@forgeai/shared";
import type {
  DirectoryListing,
  DirEntry,
  EntryKind,
  FileContent,
  FileStat,
  FileSystemPort,
  ReadDirectoryOptions,
} from "@forgeai/shared";

/**
 * An in-memory example project.
 *
 * Used when ForgeAI runs in a plain browser — `npm run dev:web` and the end-to-end tests — where
 * the native backend is not available. It implements the **same** `FileSystemPort` as the real
 * Tauri-backed implementation, so the explorer, editor and dialogs behave identically and the
 * tests exercise real logic rather than a stub.
 *
 * Everything here genuinely works: directories list, files read and write, creates, renames and
 * deletes persist for the lifetime of the process.
 */

export const EXAMPLE_PROJECT_NAME = "forgeai-demo";
/** A plausible root. Nothing on disk is touched; this path is only a label. */
export const EXAMPLE_PROJECT_ROOT = "C:\\workspace\\forgeai-demo";

/** Matches the limits enforced by the Rust backend, so behaviour is consistent. */
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_DIRECTORY_ENTRIES = 2_000;

interface DirectoryNode {
  kind: "directory";
  children: Record<string, MockNode>;
}

interface FileNode {
  kind: "file";
  content: string;
}

type MockNode = DirectoryNode | FileNode;

/* ------------------------------------------------------------------------------- contents -- */

const PACKAGE_JSON = `{
  "name": "forgeai-demo",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
`;

const TSCONFIG_JSON = `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true
  },
  "include": ["src"]
}
`;

const README_MD = `# forgeai-demo

A miniature React project used to exercise the ForgeAI IDE shell.

## Getting started

    npm install
    npm run dev

## Layout

- \`src/App.tsx\` — the application root
- \`src/components\` — reusable UI pieces
- \`src/hooks\` — custom hooks
- \`public\` — static assets served as-is
`;

const GITIGNORE = `node_modules
dist
.env
`;

const APP_TSX = `import { Button } from "../../shared/ui/Button";
import { Header } from "./components/Header";
import { useCounter } from "./hooks/useCounter";

export default function App() {
  const { count, increment } = useCounter();

  return (
    <main>
      <Header title="ForgeAI Demo" subtitle="A tiny example project" />
      <p>Clicked {count} times</p>
      <Button onClick={increment}>Run the thing</Button>
    </main>
  );
}
`;

const MAIN_TSX = `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "../../app/App";
import "./styles.css";

const container = document.getElementById("root");
if (container === null) {
  throw new Error("Root container #root was not found.");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`;

const STYLES_CSS = `:root {
  font-family: system-ui, sans-serif;
  line-height: 1.5;
  color: #1f2328;
  background-color: #f6f8fa;
}

body {
  margin: 0;
  display: grid;
  min-height: 100vh;
  place-items: center;
}

.btn {
  border-radius: 6px;
  padding: 0.5rem 1rem;
}
`;

const BUTTON_TSX = `import type { ReactNode } from "react";

export interface ButtonProps {
  readonly children: ReactNode;
  readonly onClick?: () => void;
  readonly variant?: "primary" | "secondary";
}

export function Button({ children, onClick, variant = "primary" }: ButtonProps) {
  return (
    <button className={\`btn btn--\${variant}\`} onClick={onClick} type="button">
      {children}
    </button>
  );
}
`;

const HEADER_TSX = `export interface HeaderProps {
  readonly title: string;
  readonly subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="header">
      <h1>{title}</h1>
      {subtitle !== undefined && <p className="header__subtitle">{subtitle}</p>}
    </header>
  );
}
`;

const USE_COUNTER_TS = `import { useCallback, useState } from "react";

export function useCounter(initial = 0) {
  const [count, setCount] = useState(initial);
  const increment = useCallback(() => setCount((value) => value + 1), []);
  return { count, increment };
}
`;

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Demo logo">
  <rect width="64" height="64" rx="12" fill="#1f2328" />
  <path d="M20 44V20h24v6H27v5h14v6H27v7z" fill="#f0a92a" />
</svg>
`;

/** Contains a NUL byte, so the binary-file path can be demonstrated and tested. */
const BINARY_PNG = "\u0000\u0001PNG\r\n\u001a\nbinary\u0000content";

function directory(children: Record<string, MockNode>): DirectoryNode {
  return { kind: "directory", children };
}

function text(content: string): FileNode {
  return { kind: "file", content };
}

const EXAMPLE_TREE: DirectoryNode = directory({
  src: directory({
    components: directory({
      "Button.tsx": text(BUTTON_TSX),
      "Header.tsx": text(HEADER_TSX),
    }),
    hooks: directory({
      "useCounter.ts": text(USE_COUNTER_TS),
    }),
    "App.tsx": text(APP_TSX),
    "main.tsx": text(MAIN_TSX),
    "styles.css": text(STYLES_CSS),
  }),
  public: directory({
    "logo.svg": text(LOGO_SVG),
    "logo.png": text(BINARY_PNG),
  }),
  ".gitignore": text(GITIGNORE),
  "package.json": text(PACKAGE_JSON),
  "tsconfig.json": text(TSCONFIG_JSON),
  "README.md": text(README_MD),
});

/* --------------------------------------------------------------------------- implementation - */

function toSeparators(path: string): string {
  return path.replace(/[\\/]+$/, "");
}

function joinPath(parent: string, name: string): string {
  return `${toSeparators(parent)}\\${name}`;
}

/**
 * `FileSystemPort` backed by an in-memory tree.
 *
 * A flat map of absolute path -> node is the source of truth; the tree keeps the parent/child
 * structure needed for listing. Renames re-index the moved subtree so both stay consistent.
 */
export class ExampleFileSystem implements FileSystemPort {
  readonly #root: string;
  readonly #nodes = new Map<string, MockNode>();
  readonly #modified = new Map<string, number>();

  constructor(root: string = EXAMPLE_PROJECT_ROOT, tree: DirectoryNode = EXAMPLE_TREE) {
    this.#root = toSeparators(root);
    this.#index(this.#root, tree, Date.now());
  }

  get root(): string {
    return this.#root;
  }

  #index(path: string, node: MockNode, modifiedAt: number): void {
    this.#nodes.set(path, node);
    this.#modified.set(path, modifiedAt);
    if (node.kind !== "directory") return;
    for (const [name, child] of Object.entries(node.children)) {
      this.#index(joinPath(path, name), child, modifiedAt);
    }
  }

  #deindex(path: string): void {
    const prefix = `${path}\\`;
    for (const key of [...this.#nodes.keys()]) {
      if (key === path || key.startsWith(prefix)) {
        this.#nodes.delete(key);
        this.#modified.delete(key);
      }
    }
  }

  #require(path: string): MockNode {
    const node = this.#nodes.get(toSeparators(path));
    if (node === undefined) {
      throw new FileSystemError("notFound", "That file or folder no longer exists.");
    }
    return node;
  }

  #parentOf(path: string): DirectoryNode | undefined {
    const cut = path.lastIndexOf("\\");
    if (cut <= 0) return undefined;
    const parent = this.#nodes.get(path.slice(0, cut));
    return parent?.kind === "directory" ? parent : undefined;
  }

  async readDirectory(path: string, options: ReadDirectoryOptions = {}): Promise<DirectoryListing> {
    const target = toSeparators(path);
    const node = this.#require(target);
    if (node.kind !== "directory") {
      throw new FileSystemError("notADirectory", "That path is not a folder.");
    }
    const showHidden = options.showHidden ?? true;

    const all: DirEntry[] = Object.entries(node.children)
      .filter(([name]) => showHidden || !name.startsWith("."))
      .map(([name, child]) => ({
        name,
        path: joinPath(target, name),
        kind: child.kind === "directory" ? ("directory" as EntryKind) : ("file" as EntryKind),
      }));

    all.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });

    return {
      path: target,
      entries: all.slice(0, MAX_DIRECTORY_ENTRIES),
      truncated: all.length > MAX_DIRECTORY_ENTRIES,
    };
  }

  async readFile(path: string): Promise<FileContent> {
    const target = toSeparators(path);
    const node = this.#require(target);
    if (node.kind !== "file") {
      throw new FileSystemError("isADirectory", "That path is a folder, not a file.");
    }
    const size = node.content.length;
    if (size > MAX_FILE_BYTES) return { kind: "tooLarge", size, limit: MAX_FILE_BYTES };
    if (node.content.includes("\u0000")) return { kind: "binary", size };
    return { kind: "text", text: node.content, size };
  }

  async writeTextFile(path: string, contents: string): Promise<void> {
    const target = toSeparators(path);
    const node = this.#nodes.get(target);
    if (node?.kind === "directory") {
      throw new FileSystemError("isADirectory", "That path is a folder, not a file.");
    }
    if (node === undefined) {
      throw new FileSystemError("notFound", "That file or folder no longer exists.");
    }
    node.content = contents;
    this.#modified.set(target, Date.now());
  }

  async createFile(path: string, contents = ""): Promise<void> {
    const target = toSeparators(path);
    if (this.#nodes.has(target)) {
      throw new FileSystemError("alreadyExists", "Something with that name already exists.");
    }
    const parent = this.#parentOf(target);
    if (parent === undefined) {
      throw new FileSystemError("notFound", "The folder you are creating this in no longer exists.");
    }
    const node: FileNode = { kind: "file", content: contents };
    parent.children[target.slice(target.lastIndexOf("\\") + 1)] = node;
    this.#index(target, node, Date.now());
  }

  async createDirectory(path: string): Promise<void> {
    const target = toSeparators(path);
    if (this.#nodes.has(target)) {
      throw new FileSystemError("alreadyExists", "Something with that name already exists.");
    }
    const parent = this.#parentOf(target);
    if (parent === undefined) {
      throw new FileSystemError("notFound", "The folder you are creating this in no longer exists.");
    }
    const node: DirectoryNode = { kind: "directory", children: {} };
    parent.children[target.slice(target.lastIndexOf("\\") + 1)] = node;
    this.#index(target, node, Date.now());
  }

  async rename(from: string, to: string): Promise<void> {
    const source = toSeparators(from);
    const destination = toSeparators(to);
    if (source === this.#root || destination === this.#root) {
      throw new FileSystemError("workspaceRoot", "The open folder itself cannot be changed.");
    }
    const node = this.#require(source);
    if (this.#nodes.has(destination)) {
      throw new FileSystemError("alreadyExists", "Something with that name already exists.");
    }
    const destinationParent = this.#parentOf(destination);
    if (destinationParent === undefined) {
      throw new FileSystemError("notFound", "The destination folder no longer exists.");
    }

    const sourceParent = this.#parentOf(source);
    if (sourceParent !== undefined) {
      delete sourceParent.children[source.slice(source.lastIndexOf("\\") + 1)];
    }
    destinationParent.children[destination.slice(destination.lastIndexOf("\\") + 1)] = node;
    this.#deindex(source);
    this.#index(destination, node, Date.now());
  }

  async delete(path: string, options: { readonly recursive?: boolean } = {}): Promise<void> {
    const target = toSeparators(path);
    if (target === this.#root) {
      throw new FileSystemError("workspaceRoot", "The open folder itself cannot be deleted.");
    }
    const node = this.#require(target);
    if (node.kind === "directory" && Object.keys(node.children).length > 0 && options.recursive !== true) {
      throw new FileSystemError("io", "That folder is not empty.");
    }
    const parent = this.#parentOf(target);
    if (parent !== undefined) {
      delete parent.children[target.slice(target.lastIndexOf("\\") + 1)];
    }
    this.#deindex(target);
  }

  async stat(path: string): Promise<FileStat> {
    const target = toSeparators(path);
    const node = this.#require(target);
    return {
      path: target,
      kind: node.kind === "directory" ? "directory" : "file",
      size: node.kind === "file" ? node.content.length : 0,
      modifiedAt: this.#modified.get(target) ?? 0,
    };
  }

  async exists(path: string): Promise<boolean> {
    return this.#nodes.has(toSeparators(path));
  }

  async search(
    root: string,
    pattern: string,
    options: { readonly maxResults?: number } = {},
  ): Promise<readonly string[]> {
    const needle = pattern.trim().toLowerCase();
    if (needle.length === 0) {
      throw new FileSystemError("invalidPath", "Enter something to search for.");
    }
    const base = toSeparators(root);
    if (base !== this.#root) {
      throw new FileSystemError("invalidPath", "Search is only supported from the workspace root.");
    }
    const limit = options.maxResults ?? 200;
    const matches: string[] = [];
    for (const [path, node] of this.#nodes) {
      if (node.kind !== "file") continue;
      const name = path.slice(path.lastIndexOf("\\") + 1).toLowerCase();
      if (name.includes(needle)) matches.push(path);
      if (matches.length >= limit) break;
    }
    return matches;
  }
}
