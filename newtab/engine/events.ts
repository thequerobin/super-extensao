/* SPDX-License-Identifier: GPL-3.0-only */
export interface Stream<T> {
  subscribers: Set<(value: T) => void>;
}
export const init = <T>(): Stream<T> => ({ subscribers: new Set() });
export const subscribe = <T>(
  stream: Stream<T>,
  listener: (value: T) => void,
) => {
  stream.subscribers.add(listener);
  return () => {
    stream.subscribers.delete(listener);
  };
};
export function publish<T>(stream: Stream<T>, value: T): void {
  for (const listener of [...stream.subscribers]) listener(value);
}
