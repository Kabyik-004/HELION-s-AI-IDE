import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";

import { useAppState } from "./AppStateProvider";
import { createDialogService } from "../features/dialogs/dialogService";
import { createNotify } from "../features/notifications/notify";
import { createAddFileFeature } from "../features/file-management/add-file/addFile";
import { createCreateFolderFeature } from "../features/file-management/create-folder/createFolder";
import { createRenamePathFeature } from "../features/file-management/rename-path/renamePath";
import { createDeletePathFeature } from "../features/file-management/delete-path/deletePath";
import { createLoadDirectoryFeature } from "../features/explorer/load-directory/loadDirectory";
import { createRefreshDirectoryFeature } from "../features/explorer/refresh-directory/refreshDirectory";
import { createExplorerActions, type ExplorerActions } from "../features/explorer/explorer.actions";
import { createOpenFileFeature } from "../features/editor/open-file/openFile";
import { createSaveFileFeature } from "../features/editor/save-file/saveFile";
import { createCloseFileFeature } from "../features/editor/close-file/closeFile";
import { createReloadFileFeature } from "../features/editor/reload-file/reloadFile";
import { createExternalChangesFeature } from "../features/editor/external-changes/detectExternalChanges";
import { createEditorActions, type EditorActions } from "../features/editor/editor.actions";
import { createOpenProjectFeature } from "../features/workspace/open-project/openProject";
import { createCloseProjectFeature } from "../features/workspace/close-project/closeProject";
import { createSendMessageFeature } from "../features/assistant/send-message/sendMessage";
import { createPanelActions, type PanelActions } from "../features/panels/panels.actions";
import { ideReducer } from "./ideReducer";
import { createInitialIdeState, type IdeState } from "./ideTypes";
import type { FeatureDeps, RecentProjectsPort } from "./featureContext";
import type { IdeAction } from "./ideActions";

/** What the composition root hands to the UI: one entry per feature, grouped by domain. */
export interface IdeApi {
  readonly workspace: {
    openFromPicker(): Promise<void>;
    openPath(path: string): Promise<void>;
    closeProject(): Promise<void>;
  };
  readonly explorer: ExplorerActions & {
    refreshTree(): Promise<void>;
    refreshDirectory(path: string): Promise<void>;
  };
  readonly files: {
    addFile(directoryPath: string): Promise<void>;
    createFolder(directoryPath: string): Promise<void>;
    renamePath(path: string): Promise<void>;
    deletePath(path: string): Promise<void>;
  };
  readonly editor: EditorActions & {
    openFile(path: string): void;
    requestClose(path: string): Promise<void>;
    closeAllTabs(): Promise<void>;
    saveFile(path: string): Promise<boolean>;
    saveAllFiles(): Promise<void>;
    reloadFile(path: string): Promise<void>;
    checkForExternalChanges(): Promise<void>;
  };
  readonly assistant: {
    sendMessage(content: string): void;
  };
  readonly panels: PanelActions;
  readonly ui: {
    dismissNotification(id: string): void;
    answerPrompt(value: string | null): void;
    answerConfirm(confirmed: boolean): void;
    answerUnsaved(choice: "save" | "discard" | "cancel"): void;
  };
}

export interface IdeContextValue {
  readonly state: IdeState;
  readonly api: IdeApi;
}

const IdeContext = createContext<IdeContextValue | undefined>(undefined);

/**
 * Composes every feature and provides the resulting API.
 *
 * This is the only file that knows which features exist and how they are wired together. Each
 * feature is handed its dependencies — including, where needed, another feature's function — so no
 * feature imports another. That is what makes them independently testable and replaceable.
 */
export function IdeProvider({ children }: { readonly children: ReactNode }) {
  const { services, rememberProject } = useAppState();
  const [state, rawDispatch] = useReducer(ideReducer, services.workspace.current(), createInitialIdeState);

  // Mirrors the latest state so operations can read it without being recreated on every change.
  const stateRef = useRef(state);
  stateRef.current = state;

  const dispatch = useCallback((action: IdeAction) => rawDispatch(action), []);

  const fileSystem = useCallback(() => {
    try {
      return services.workspace.fileSystem();
    } catch {
      return null;
    }
  }, [services.workspace]);

  const dialogs = useMemo(() => createDialogService(dispatch), [dispatch]);
  const notify = useMemo(() => createNotify(dispatch), [dispatch]);

  const recentProjects = useMemo<RecentProjectsPort>(
    () => ({
      list: () => services.config.get().project.recentProjects,
      remember: rememberProject,
    }),
    [services.config, rememberProject],
  );

  const deps = useMemo<FeatureDeps>(
    () => ({
      fileSystem,
      workspace: services.workspace,
      recentProjects,
      getState: () => stateRef.current,
      dispatch,
      dialogs,
      notify,
      logger: services.logger,
    }),
    [fileSystem, services.workspace, services.logger, recentProjects, dispatch, dialogs, notify],
  );

  const api = useMemo<IdeApi>(() => {
    const loadDirectory = createLoadDirectoryFeature(deps);
    const refresh = createRefreshDirectoryFeature(deps, { loadDirectory: loadDirectory.loadDirectory });
    const editorActions = createEditorActions(deps);
    const openFile = createOpenFileFeature(deps);
    const saveFile = createSaveFileFeature(deps);
    const closeFile = createCloseFileFeature(deps, { saveFile: saveFile.saveFile });
    const reloadFile = createReloadFileFeature(deps);
    const externalChanges = createExternalChangesFeature(deps);
    const explorerActions = createExplorerActions(deps, { loadDirectory: loadDirectory.loadDirectory });
    const openProject = createOpenProjectFeature(deps, { loadDirectory: loadDirectory.loadDirectory });
    const closeProject = createCloseProjectFeature(deps);
    const addFile = createAddFileFeature(deps, {
      reloadDirectory: loadDirectory.loadDirectory,
      openFile: openFile.openFile,
    });
    const createFolder = createCreateFolderFeature(deps, { reloadDirectory: loadDirectory.loadDirectory });
    const renamePath = createRenamePathFeature(deps, { reloadDirectory: loadDirectory.loadDirectory });
    const deletePath = createDeletePathFeature(deps, { reloadDirectory: loadDirectory.loadDirectory });
    const sendMessage = createSendMessageFeature(deps);
    const panels = createPanelActions(deps);

    return {
      workspace: {
        openFromPicker: openProject.openFromPicker,
        openPath: openProject.openPath,
        closeProject: closeProject.closeProject,
      },
      explorer: {
        ...explorerActions,
        refreshTree: refresh.refreshTree,
        refreshDirectory: refresh.refreshDirectory,
      },
      files: {
        addFile: addFile.addFile,
        createFolder: createFolder.createFolder,
        renamePath: renamePath.renamePath,
        deletePath: deletePath.deletePath,
      },
      editor: {
        ...editorActions,
        openFile: openFile.openFile,
        requestClose: closeFile.requestClose,
        closeAllTabs: closeFile.closeAll,
        saveFile: saveFile.saveFile,
        saveAllFiles: saveFile.saveAllFiles,
        reloadFile: reloadFile.reloadFile,
        checkForExternalChanges: externalChanges.checkForExternalChanges,
      },
      assistant: { sendMessage: sendMessage.sendMessage },
      panels,
      ui: {
        dismissNotification(id: string): void {
          dispatch({ type: "notificationDismissed", id });
        },
        answerPrompt(value: string | null): void {
          const dialog = stateRef.current.dialogs.dialog;
          dispatch({ type: "dialogClosed" });
          if (dialog?.kind === "prompt") dialog.resolve(value);
        },
        answerConfirm(confirmed: boolean): void {
          const dialog = stateRef.current.dialogs.dialog;
          dispatch({ type: "dialogClosed" });
          if (dialog?.kind === "confirm") dialog.resolve(confirmed);
        },
        answerUnsaved(choice: "save" | "discard" | "cancel"): void {
          const dialog = stateRef.current.dialogs.dialog;
          dispatch({ type: "dialogClosed" });
          if (dialog?.kind === "unsaved") dialog.resolve(choice);
        },
      },
    };
  }, [deps, dispatch]);

  // If the environment already has a workspace (the browser preview does), read its root once.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const current = services.workspace.current();
    if (current !== null) void loadRoot(api, current.path);
  }, [api, services.workspace]);

  // Basic external-change detection: compare on regaining focus rather than watching continuously.
  useEffect(() => {
    const onFocus = () => void api.editor.checkForExternalChanges();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [api]);

  const value = useMemo<IdeContextValue>(() => ({ state, api }), [state, api]);

  return <IdeContext.Provider value={value}>{children}</IdeContext.Provider>;
}

async function loadRoot(api: IdeApi, path: string): Promise<void> {
  await api.explorer.refreshDirectory(path);
}

/** The whole IDE context. Throws when used outside the provider (a programming error). */
export function useIde(): IdeContextValue {
  const value = useContext(IdeContext);
  if (value === undefined) {
    throw new Error("useIde() must be used inside <IdeProvider>.");
  }
  return value;
}

/** Convenience for components that only read state. */
export function useIdeState(): IdeState {
  return useIde().state;
}

/** Convenience for components that only call operations. */
export function useIdeApi(): IdeApi {
  return useIde().api;
}
