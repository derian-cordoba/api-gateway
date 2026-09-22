import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";

const { readBody, readRawBody, pathParts } = require("../../../examples/shared/http");

function request(contentType = "application/json") {
  return Object.assign(new EventEmitter(), { headers: { "content-type": contentType } });
}

describe("example HTTP helpers", () => {
  it("decodes UTF-8 JSON after combining chunks", async () => {
    const req = request();
    const parsed = readBody(req);
    const body = Buffer.from('{"name":"José"}');
    for (const byte of body) req.emit("data", Buffer.from([byte]));
    req.emit("end");
    expect(await parsed).toEqual({ name: "José" });
  });

  it("parses OAuth form bodies", async () => {
    const req = request("application/x-www-form-urlencoded");
    const parsed = readBody(req);
    req.emit("data", Buffer.from("token=a%2Bb&hint=access_token"));
    req.emit("end");
    expect(await parsed).toEqual({ token: "a+b", hint: "access_token" });
  });

  it("rejects oversized, invalid, and interrupted bodies", async () => {
    const oversized = request();
    const bounded = readRawBody(oversized, 2);
    oversized.emit("data", Buffer.from("123"));
    await expect(bounded).rejects.toMatchObject({ statusCode: 413 });
    const invalid = request();
    const parsed = readBody(invalid);
    invalid.emit("data", Buffer.from("{"));
    invalid.emit("end");
    await expect(parsed).rejects.toMatchObject({ statusCode: 400 });
    const interrupted = request();
    const pending = readRawBody(interrupted);
    interrupted.emit("aborted");
    await expect(pending).rejects.toThrow("Request aborted");
  });

  it("excludes query parameters from route segments", () => {
    expect(pathParts({ url: "/42?next=/other" })).toEqual(["42"]);
  });
});
