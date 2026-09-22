import { createPublicKey, type JsonWebKey as NodeJsonWebKey } from "node:crypto";
import { logger } from "../../logger";
import { toError } from "../../../../shared/errors/toError";

type JsonWebKey = {
  readonly kid?: string;
  readonly kty?: string;
  readonly use?: string;
  [key: string]: unknown;
};

type JwksResponse = {
  readonly keys: JsonWebKey[];
};

/**
 * Fetches and caches public keys from a JWKS (JSON Web Key Set) endpoint.
 *
 * Keys are cached in-process after the first successful fetch and re-fetched
 * only when a request arrives with a `kid` not present in the current cache,
 * which handles key rotation without a fixed TTL.
 *
 * Uses Node 18+'s built-in `fetch` and `node:crypto` — no additional
 * dependencies required.
 */
export class JwksKeyStore {
  // PEM-encoded public keys keyed by `kid`.
  private readonly keysByKid = new Map<string, string>();
  private lastFetchedAt: number = 0;
  // Minimum milliseconds between re-fetches to avoid hammering the JWKS endpoint.
  private static readonly REFETCH_COOLDOWN_MS = 60_000;

  constructor(private readonly jwksUri: string) {}

  /**
   * Returns the PEM-encoded public key for the given `kid`.
   *
   * Fetches the JWKS endpoint on the first call or when `kid` is not found in
   * the cache and the cooldown has elapsed. Throws if the key cannot be found.
   */
  async getPublicKey(kid: string): Promise<string> {
    const cached = this.keysByKid.get(kid);
    if (cached !== undefined) return cached;

    await this.fetchAndCache();

    const fetched = this.keysByKid.get(kid);
    if (fetched === undefined) {
      throw new Error(`No JWKS key found for kid "${kid}"`);
    }
    return fetched;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async fetchAndCache(): Promise<void> {
    const now = Date.now();
    if (now - this.lastFetchedAt < JwksKeyStore.REFETCH_COOLDOWN_MS) {
      return; // Cooldown not elapsed — don't hammer the endpoint
    }

    this.lastFetchedAt = now;

    const response = await fetch(this.jwksUri);
    if (!response.ok) {
      throw new Error(`JWKS endpoint returned HTTP ${response.status}`);
    }

    const body = (await response.json()) as JwksResponse;
    this.keysByKid.clear();

    for (const jwk of body.keys) {
      if (!jwk.kid) continue;
      try {
        const keyObject = createPublicKey({ key: jwk as unknown as NodeJsonWebKey, format: "jwk" as const });
        const pem = keyObject.export({ type: "spki", format: "pem" }) as string;
        this.keysByKid.set(jwk.kid, pem);
      } catch (err) {
        logger.warn({ jwksUri: this.jwksUri, kid: jwk.kid, err: toError(err) }, "Failed to import JWKS key");
      }
    }

    logger.debug({ jwksUri: this.jwksUri, keyCount: this.keysByKid.size }, "JWKS keys refreshed");
  }
}
