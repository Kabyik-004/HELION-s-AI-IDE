import { newId } from "@forgeai/shared";

import type { FeatureDeps } from "../../../app/featureContext";

/**
 * Send a message to the assistant.
 *
 * UI only: this module records the message in the transcript and states plainly that nothing was
 * sent, because no provider is connected. When the provider module lands, only this body changes —
 * the panel, the composer and the state slice stay as they are.
 */
export interface SendMessageFeature {
  sendMessage(content: string): void;
}

export function createSendMessageFeature(deps: FeatureDeps): SendMessageFeature {
  return {
    sendMessage(content: string): void {
      const text = content.trim();
      if (text.length === 0) return;

      deps.dispatch({
        type: "messageAppended",
        message: { id: newId("msg"), role: "user", content: text, status: "sent", createdAt: Date.now() },
      });
      deps.dispatch({
        type: "messageAppended",
        message: {
          id: newId("msg"),
          role: "system",
          status: "notice",
          content: "No provider is connected, so this message was not sent.",
          createdAt: Date.now(),
        },
      });
    },
  };
}
