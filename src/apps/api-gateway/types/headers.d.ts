export declare type HeaderTransform = {
  /**
   * Headers to add or override on the request / response.
   * Keys are header names (case-insensitive), values are the header values.
   */
  set?: Record<string, string>;

  /**
   * Header names to remove from the request / response.
   */
  remove?: string[];
};

export declare type HeadersConfig = {
  /**
   * Transforms applied to the outgoing request sent to the upstream.
   */
  request?: HeaderTransform;

  /**
   * Transforms applied to the response returned to the client.
   */
  response?: HeaderTransform;
};
