import * as monaco from "monaco-editor";
import { useCallback, useEffect } from "react";

import { useIde } from "../../../app/IdeProvider";
import { formatBytes } from "../../../shared/format/format";
import { baseName } from "../../../shared/path/path";
import type { EditorProblem, ProblemSeverity } from "../../../shared/types/problem";
import { Button } from "../../../shared/ui/Button";
import { WarningIcon } from "../../../shared/ui/Icons";
import type { EditorBuffer } from "../editor.types";
import { CodeEditor } from "./CodeEditor";
import { EditorTabs } from "../tabs/EditorTabs";
import { WelcomeView } from "../welcome/WelcomeView";

/** The editor column: tabs, plus whichever document is active. */
export function EditorArea() {
  const { state, api } = useIde();
  const { editor } = state;
  const activeBuffer = editor.activeTabPath === null ? undefined : editor.buffers[editor.activeTabPath];

  const syncProblems = useCallback(() => {
    // Diagnostics come from Monaco's language workers, so the Problems panel reflects real
    // analysis rather than a placeholder list.
    const problems: EditorProblem[] = monaco.editor.getModelMarkers({}).map((marker) => ({
      path: marker.resource.path.replace(/^[/\\]/, ""),
      severity: severityOf(marker.severity),
      message: marker.message,
      line: marker.startLineNumber,
      column: marker.startColumn,
    }));
    api.editor.setProblems(problems);
  }, [api.editor]);

  useEffect(() => {
    const subscription = monaco.editor.onDidChangeMarkers(syncProblems);
    syncProblems();
    return () => subscription.dispose();
  }, [syncProblems]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-ink-950">
      {editor.tabs.length > 0 && <EditorTabs />}

      {activeBuffer?.externallyChanged === true && (
        <div className="flex shrink-0 items-center gap-2 border-b border-warning-500/40 bg-warning-500/10 px-3 py-1.5 text-[11px] text-warning-500">
          <WarningIcon size={13} className="shrink-0" />
          <span className="flex-1">
            This file changed on disk since you opened it. Saving will overwrite those changes.
          </span>
          <Button variant="ghost" onClick={() => void api.editor.reloadFile(activeBuffer.path)}>
            Reload from disk
          </Button>
        </div>
      )}

      <div className="min-h-0 flex-1">
        {activeBuffer === undefined ? <WelcomeView /> : <EditorBody buffer={activeBuffer} />}
      </div>
    </div>
  );
}

function EditorBody({ buffer }: { readonly buffer: EditorBuffer }) {
  if (buffer.loading) {
    return <EditorNotice title={`Reading ${baseName(buffer.path)}…`} body="One moment." />;
  }
  if (buffer.error !== undefined) {
    return <EditorNotice title="Could not open this file" body={buffer.error} tone="danger" />;
  }
  if (buffer.kind === "binary") {
    return (
      <EditorNotice
        title="Binary file"
        body={`${baseName(buffer.path)} is ${formatBytes(buffer.size)} of non-text data, so it is not shown in the editor.`}
      />
    );
  }
  if (buffer.kind === "tooLarge") {
    return (
      <EditorNotice
        title="File is too large to open"
        body={`${baseName(buffer.path)} is ${formatBytes(buffer.size)}. ForgeAI does not load files of this size into the editor.`}
      />
    );
  }
  return <CodeEditor buffer={buffer} />;
}

function EditorNotice({
  title,
  body,
  tone = "muted",
}: {
  readonly title: string;
  readonly body: string;
  readonly tone?: "muted" | "danger";
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 px-8 text-center">
      <p className={`text-xs font-medium ${tone === "danger" ? "text-danger-500" : "text-ink-200"}`}>{title}</p>
      <p className="max-w-sm text-[11px] leading-relaxed text-ink-400">{body}</p>
    </div>
  );
}

function severityOf(severity: monaco.MarkerSeverity): ProblemSeverity {
  if (severity >= monaco.MarkerSeverity.Error) return "error";
  if (severity >= monaco.MarkerSeverity.Warning) return "warning";
  return "info";
}
