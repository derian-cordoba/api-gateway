export function isErrorWithCode<Code extends string>(
  cause: unknown,
  code: Code,
): cause is Error & { code: Code } {
  return cause instanceof Error && "code" in cause && cause.code === code;
}
