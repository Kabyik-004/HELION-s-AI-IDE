import type { AppNotification } from "./notifications.types";
import type { IdeAction } from "../../app/ideActions";

/** Recent notifications. Kept short: the newest messages are the ones worth seeing. */
export interface NotificationsSliceState {
  readonly notifications: readonly AppNotification[];
}

const MAX_VISIBLE = 4;

export function initialNotificationsSlice(): NotificationsSliceState {
  return { notifications: [] };
}

export type NotificationsAction =
  | { readonly type: "notificationAdded"; readonly notification: AppNotification }
  | { readonly type: "notificationDismissed"; readonly id: string }
  | { readonly type: "notificationsCleared" };

export function reduceNotifications(
  state: NotificationsSliceState,
  action: IdeAction,
): NotificationsSliceState {
  switch (action.type) {
    case "notificationAdded":
      return { ...state, notifications: [...state.notifications, action.notification].slice(-MAX_VISIBLE) };
    case "notificationDismissed":
      return { ...state, notifications: state.notifications.filter((item) => item.id !== action.id) };
    case "notificationsCleared":
      return { ...state, notifications: [] };
    default:
      return state;
  }
}
