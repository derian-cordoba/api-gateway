export type BalancerStrategy = "round-robin" | "weighted" | "least-connections";

export type WeightedTarget = {
  /**
   * The upstream URL for this target.
   */
  url: string;

  /**
   * Relative weight for the "weighted" strategy.
   * Higher values receive proportionally more traffic.
   * Defaults to 1 when omitted.
   * Ignored by "round-robin" and "least-connections".
   */
  weight?: number;
};
