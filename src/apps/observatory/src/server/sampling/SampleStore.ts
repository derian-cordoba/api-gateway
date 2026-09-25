import type { GatewayOverview } from "../gateway/contracts";

type Sample = Pick<GatewayOverview, "timestamp" | "routes">;
const RETENTION_MS = 6 * 60 * 60 * 1_000;

class SampleStore {
  private samples: Sample[] = [];

  add(overview: GatewayOverview): void {
    this.samples.push({
      timestamp: overview.timestamp,
      routes: overview.routes,
    });
    const cutoff = Date.now() - RETENTION_MS;
    this.samples = this.samples.filter(
      (sample) => Date.parse(sample.timestamp) >= cutoff,
    );
  }

  latest(): Sample | null {
    return this.samples.at(-1) ?? null;
  }
}

export const sampleStore = new SampleStore();
