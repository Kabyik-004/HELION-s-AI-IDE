import type { Disposable } from "./disposable";

export type Listener<T> = (event: T) => void;

/**
 * Minimal typed event emitter.
 *
 * ForgeAI avoids a dependency on Node's `EventEmitter` because the same code runs in
 * the browser (React) and in Node contexts, and because a typed emitter makes the
 * event contract explicit at every call site.
 */
export class Emitter<T> {
  #listeners = new Set<Listener<T>>();

  /** Subscribes to events. Dispose the returned handle to unsubscribe. */
  on(listener: Listener<T>): Disposable {
    this.#listeners.add(listener);
    return {
      dispose: () => {
        this.#listeners.delete(listener);
      },
    };
  }

  /** Delivers an event to every current listener. */
  emit(event: T): void {
    // Iterate over a copy so a listener may unsubscribe during delivery.
    for (const listener of [...this.#listeners]) {
      listener(event);
    }
  }

  get size(): number {
    return this.#listeners.size;
  }
}
