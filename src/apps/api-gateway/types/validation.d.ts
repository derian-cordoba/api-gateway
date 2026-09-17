export declare type ValidationConfig = {
  /**
   * List of top-level request body fields that must be present and non-null.
   * Returns 422 Unprocessable Entity if any are missing.
   */
  requiredFields?: string[];

  /**
   * Allowed Content-Type values (case-insensitive substring match).
   * Example: `["application/json", "application/x-www-form-urlencoded"]`
   * Returns 415 Unsupported Media Type if the request content type does not match.
   * When omitted, any content type is accepted.
   */
  allowedContentTypes?: string[];

  /**
   * Maximum allowed request body size in bytes.
   * Returns 413 Content Too Large if the Content-Length header exceeds this value.
   * When omitted, no size check is applied.
   */
  maxBodyBytes?: number;
};
