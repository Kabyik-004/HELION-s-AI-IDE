import { newId } from "@forgeai/shared";

import type { IdeAction } from "../../app/ideActions";
import type { NotificationSeverity } from "./notifications.types";

/**
 * The public interface other features use to tell the developer something.
 *
 * Features call this; the `NotificationCenter` component is the only thing that renders it.
 */
export type Notify = (
  severity: NotificationSeverity,
  title: string,
  message?: string,
  detail?: string,
) => void;

export function createNotify(dispatch: (action: IdeAction) => void): Notify {
  return (severity, title, message, detail) => {
    dispatch({
      type: "notificationAdded",
      notification: { id: newId("note"), severity, title, message, detail, createdAt: Date.now() },
    });
  };
}
