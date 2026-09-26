import { HttpMethod } from "../../http/HttpMethod";
import { StatusCodes } from "http-status-codes";
import { withErrorContext } from "../../errors/withErrorContext";
import { isRecord } from "../../guards/isRecord";
import type { HttpRequestOptions } from "./contracts";
import { HttpError } from "./HttpError";

export async function readResponse<T>(
  response: Response,
  options: HttpRequestOptions<T>,
): Promise<T> {
  if (!response.ok) {
    const text = await response.text();

    let payload: unknown = text;
    try {
      payload = JSON.parse(text);
    } catch {
      // Non-JSON error pages still represent HTTP failures, not decoding failures.
    }

    const message = isRecord(payload)
      ? typeof payload.message === "string"
        ? payload.message
        : typeof payload.error === "string"
          ? payload.error
          : undefined
      : undefined;

    throw new HttpError(
      message ?? `HTTP request failed (${response.status}).`,
      "http",
      response.status,
      payload,
    );
  }

  return withErrorContext(
    async () => {
      let data: unknown;
      if (
        options.method === HttpMethod.HEAD ||
        response.status === StatusCodes.NO_CONTENT ||
        response.status === StatusCodes.RESET_CONTENT
      ) {
        data = undefined;
      } else {
        switch (options.responseType ?? "json") {
          case "text":
            data = await response.text();
            break;
          case "blob":
            data = await response.blob();
            break;
          case "arrayBuffer":
            data = await response.arrayBuffer();
            break;
          case "json": {
            const text = await response.text();
            data = text.length ? JSON.parse(text) : undefined;
            break;
          }
        }
      }
      return options.decode ? options.decode(data) : (data as T);
    },
    {
      createException: (cause) =>
        new HttpError(
          "The HTTP response could not be decoded.",
          "decode",
          response.status,
          undefined,
          { cause },
        ),
    },
  );
}
