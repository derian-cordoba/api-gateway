import type { HttpTransport } from "../contracts";

export class FetchHttpClient implements HttpTransport {
  constructor(private readonly fetcher?: typeof fetch) {}

  send(url: string, init: RequestInit): Promise<Response> {
    return (this.fetcher ?? globalThis.fetch)(url, init);
  }
}
