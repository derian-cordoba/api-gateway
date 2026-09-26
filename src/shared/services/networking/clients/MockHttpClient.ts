import { HttpMethod } from "../../../http/HttpMethod";
import type { HttpTransport } from "../contracts";
import { HttpError } from "../HttpError";

export type MockRequest = {
  url: URL;
  headers: Headers;
  init: RequestInit;
};

export type MockRoute = {
  method: HttpMethod;
  /** Exact pathname; query values are available to the handler. */
  path: string;
  respond: (request: MockRequest) => Response | Promise<Response>;
};

export class MockHttpClient implements HttpTransport {
  private readonly routes: readonly MockRoute[];

  constructor(routes: readonly MockRoute[]) {
    this.routes = routes.map((route) => ({ ...route }));
  }

  async send(url: string, init: RequestInit): Promise<Response> {
    init.signal?.throwIfAborted();

    const parsedURL = new URL(url, "http://mock.local");
    const method = init.method ?? HttpMethod.GET;
    const route = this.routes.find(
      (candidate) =>
        candidate.method === method && candidate.path === parsedURL.pathname,
    );

    if (!route) {
      throw new HttpError(
        `No mock handler for ${method} ${parsedURL.pathname}.`,
        "configuration",
      );
    }

    return route.respond({
      url: parsedURL,
      headers: new Headers(init.headers),
      init,
    });
  }
}
