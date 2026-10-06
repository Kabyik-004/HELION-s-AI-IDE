/** A handle that releases whatever resource it represents. */
export interface Disposable {
  dispose(): void;
}

/** Groups several disposables so they can be released together. */
export class DisposableStore implements Disposable {
  #items = new Set<Disposable>();

  add<T extends Disposable>(item: T): T {
    this.#items.add(item);
    return item;
  }

  dispose(): void {
    for (const item of this.#items) {
      item.dispose();
    }
    this.#items.clear();
  }
}
