import { describe, expect, expectTypeOf, it } from "vitest";
import { omitUndefined } from "../../../src/shared/objects/omitUndefined";

describe("omitUndefined", () => {
  it("removes undefined properties without mutating the source", () => {
    const source = {
      required: "value",
      omitted: undefined as string | undefined,
      falseValue: false,
      zeroValue: 0,
      emptyValue: "",
      nullValue: null,
    };

    const result = omitUndefined(source);

    expect(result).toEqual({
      required: "value",
      falseValue: false,
      zeroValue: 0,
      emptyValue: "",
      nullValue: null,
    });
    expect(source).toHaveProperty("omitted");
    expectTypeOf(result.omitted).toEqualTypeOf<string | undefined>();
  });

  it("only removes undefined values at the top level", () => {
    const nested = { omitted: undefined };

    expect(omitUndefined({ nested })).toEqual({ nested });
  });
});
