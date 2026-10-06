import type { ChatViewMessage } from "../../shared/types/chat";
import type { IdeAction } from "../../app/ideActions";

/**
 * The assistant's state: the visible transcript.
 *
 * UI only until a provider module lands. The message list is owned here so the chat panel and the
 * composer never hold conversation state themselves.
 */
export interface AssistantSliceState {
  readonly messages: readonly ChatViewMessage[];
}

export function initialAssistantSlice(): AssistantSliceState {
  const now = Date.now();
  return {
    messages: [
      {
        id: "intro",
        role: "assistant",
        status: "sent",
        content:
          "I can help you understand and modify your project. Ask me about a file, or describe a change you want to make.",
        createdAt: now,
      },
      {
        id: "intro-notice",
        role: "system",
        status: "notice",
        content: "No AI provider is connected yet. Provider setup and streaming replies arrive in Module 3.",
        createdAt: now + 1,
      },
    ],
  };
}

export type AssistantAction = { readonly type: "messageAppended"; readonly message: ChatViewMessage };

export function reduceAssistant(state: AssistantSliceState, action: IdeAction): AssistantSliceState {
  switch (action.type) {
    case "messageAppended":
      return { ...state, messages: [...state.messages, action.message] };
    default:
      return state;
  }
}
