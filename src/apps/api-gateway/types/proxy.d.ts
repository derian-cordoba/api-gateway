export declare type Proxy = {
  /**
   * The target URL to proxy requests to.
   */
  target: string;

  /**
   * Determine if the proxy route should be secure.
   */
  isSecure?: boolean;

  /**
   * Change the origin of the host header to the target URL.
   */
  changeOrigin?: boolean;

  /**
   * Path rewriting rules for the proxy.
   */
  pathRewrite?: {
    /**
     * The path to rewrite the request URL.
     */
    [key: string]: string;
  };

  /**
   * Headers to add to the request.
   */
  headers?: {
    /**
     * The name of the header.
     */
    [key: string]: string;
  };

  /**
   * The HTTP method to use for the request.
   */
  method?: string;

  /**
   * The timeout for the request in milliseconds.
   */
  timeout?: number;
};
