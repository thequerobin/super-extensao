/** A command invalidates previous async work synchronously, before its first await. */
export class ConnectionLifecycle {
  private generation = 0;
  capture(): number {
    return this.generation;
  }
  advance(): number {
    return ++this.generation;
  }
  isCurrent(generation: number): boolean {
    return generation === this.generation;
  }
  guard(generation = this.capture()): () => boolean {
    return () => this.isCurrent(generation);
  }
}
