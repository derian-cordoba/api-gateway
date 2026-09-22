export type WithoutUndefined<ObjectType extends object> = {
  [
    Key in keyof ObjectType as undefined extends ObjectType[Key] ? never : Key
  ]: ObjectType[Key];
} & {
  [
    Key in keyof ObjectType as undefined extends ObjectType[Key] ? Key : never
  ]?: Exclude<ObjectType[Key], undefined>;
};

/**
 * Returns a shallow copy of a plain object without properties whose value is undefined.
 */
export function omitUndefined<ObjectType extends object>(
  object: ObjectType,
): WithoutUndefined<ObjectType> {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  ) as WithoutUndefined<ObjectType>;
}
