export type NotificationSeverity = "error" | "warning" | "info" | "success";

/** A message shown to the developer: an operation outcome, usually a failure. */
export interface AppNotification {
  readonly id: string;
  readonly severity: NotificationSeverity;
  readonly title: string;
  /** Human-readable explanation. */
  readonly message?: string;
  /** Technical context, shown behind a "details" affordance. */
  readonly detail?: string;
  readonly createdAt: number;
}
