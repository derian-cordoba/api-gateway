/** Merge into a new Headers instance; later sources override earlier ones case-insensitively. */
export function merge(
  ...sources: Array<ConstructorParameters<typeof Headers>[0]>
): Headers {
  const headers = new Headers();
  for (const source of sources) {
    new Headers(source).forEach((value, key) => headers.set(key, value));
  }
  return headers;
}
