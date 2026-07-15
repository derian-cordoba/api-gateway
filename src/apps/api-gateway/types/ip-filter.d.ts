export declare type IpFilter = {
  /**
   * IP addresses or CIDR ranges (IPv4) that are explicitly allowed.
   * When set, only requests from a matching address are forwarded.
   * At least one entry required when the field is present.
   */
  allow?: string[];

  /**
   * IP addresses or CIDR ranges (IPv4) that are explicitly blocked.
   * Evaluated before the allow list — a match returns 403 immediately.
   * At least one entry required when the field is present.
   */
  deny?: string[];
};
