import { useState } from "react";

import { useIde } from "../../app/IdeProvider";
import { CloseIcon, ErrorIcon, InfoIcon, WarningIcon } from "../../shared/ui/Icons";
import type { AppNotification, NotificationSeverity } from "./notifications.types";

const ICONS: Record<NotificationSeverity, typeof InfoIcon> = {
  error: ErrorIcon,
  warning: WarningIcon,
  info: InfoIcon,
  success: InfoIcon,
};

const ACCENTS: Record<NotificationSeverity, string> = {
  error: "border-l-danger-500 text-danger-500",
  warning: "border-l-warning-500 text-warning-500",
  info: "border-l-info-500 text-info-500",
  success: "border-l-success-500 text-success-500",
};

/**
 * Error and status messages.
 *
 * File system failures are shown here rather than swallowed: a save that did not happen must be
 * impossible to miss. The backend supplies human-readable wording, so what appears is "That file or
 * folder no longer exists." rather than a raw OS error — the technical detail is available behind a
 * toggle for debugging.
 */
export function NotificationCenter() {
  const { state, api } = useIde();
  const { notifications } = state.notifications;

  if (notifications.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-9 right-3 z-[110] flex w-80 flex-col gap-2"
    >
      {notifications.map((notification) => (
        <NotificationCard
          key={notification.id}
          notification={notification}
          onDismiss={() => api.ui.dismissNotification(notification.id)}
        />
      ))}
    </div>
  );
}

function NotificationCard({
  notification,
  onDismiss,
}: {
  readonly notification: AppNotification;
  readonly onDismiss: () => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const Icon = ICONS[notification.severity];

  return (
    <div
      role="status"
      className={[
        "pointer-events-auto rounded border border-ink-700 border-l-2 bg-ink-850 p-2.5 shadow-lg shadow-black/40",
        ACCENTS[notification.severity],
      ].join(" ")}
    >
      <div className="flex items-start gap-2">
        <Icon size={14} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-ink-100">{notification.title}</p>
          {notification.message !== undefined && (
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-300">{notification.message}</p>
          )}
          {notification.detail !== undefined && (
            <>
              <button
                type="button"
                onClick={() => setShowDetail((value) => !value)}
                className="mt-1 text-[10px] text-ink-500 underline decoration-dotted hover:text-ink-300"
              >
                {showDetail ? "Hide details" : "Details"}
              </button>
              {showDetail && (
                <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded bg-ink-950 p-1.5 font-mono text-[10px] text-ink-400">
                  {notification.detail}
                </pre>
              )}
            </>
          )}
        </div>
        <button
          type="button"
          aria-label="Dismiss notification"
          title="Dismiss"
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 text-ink-500 transition-colors hover:bg-ink-700 hover:text-ink-200"
        >
          <CloseIcon size={12} />
        </button>
      </div>
    </div>
  );
}
