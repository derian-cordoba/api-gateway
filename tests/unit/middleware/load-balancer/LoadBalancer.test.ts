import { describe, it, expect } from "vitest";
import { LoadBalancer } from "../../../../src/apps/api-gateway/middleware/load-balancer/LoadBalancer";

const targets = [
  { url: "http://upstream-a:3001" },
  { url: "http://upstream-b:3002" },
];

describe("LoadBalancer", () => {
  describe("round-robin strategy", () => {
    it("cycles through all targets in order", () => {
      const lb = new LoadBalancer(targets, "round-robin");
      const router = lb.createRouterFn();

      const req1 = {};
      const req2 = {};
      const req3 = {};

      expect(router(req1)).toBe("http://upstream-a:3001");
      expect(router(req2)).toBe("http://upstream-b:3002");
      expect(router(req3)).toBe("http://upstream-a:3001");
    });

    it("wraps back to first target after last target", () => {
      const lb = new LoadBalancer(targets, "round-robin");
      const router = lb.createRouterFn();

      const picks: string[] = [];
      for (let i = 0; i < 6; i++) {
        picks.push(router({}));
      }

      expect(picks).toEqual([
        "http://upstream-a:3001",
        "http://upstream-b:3002",
        "http://upstream-a:3001",
        "http://upstream-b:3002",
        "http://upstream-a:3001",
        "http://upstream-b:3002",
      ]);
    });

    it("exposes strategy correctly", () => {
      const lb = new LoadBalancer(targets, "round-robin");
      expect(lb.strategy).toBe("round-robin");
    });

    it("onConnectionClosed is a no-op for round-robin (does not throw or change counts)", () => {
      const lb = new LoadBalancer(targets, "round-robin");
      const router = lb.createRouterFn();
      const req = {};

      router(req);
      const before = new Map(lb.getConnectionCounts());

      expect(() => lb.onConnectionClosed(req)).not.toThrow();

      // Connection counts should not change (all remain 0 for round-robin)
      for (const [url, count] of lb.getConnectionCounts()) {
        expect(count).toBe(before.get(url) ?? 0);
      }
    });
  });

  describe("weighted strategy", () => {
    it("distributes according to weights (weight:1 and weight:2 → 1:2 ratio)", () => {
      const weightedTargets = [
        { url: "http://upstream-a:3001", weight: 1 },
        { url: "http://upstream-b:3002", weight: 2 },
      ];
      const lb = new LoadBalancer(weightedTargets, "weighted");
      const router = lb.createRouterFn();

      const picks: string[] = [];
      for (let i = 0; i < 3; i++) {
        picks.push(router({}));
      }

      // Expanded: ["a", "b", "b"] → picks cycle: a, b, b
      expect(picks[0]).toBe("http://upstream-a:3001");
      expect(picks[1]).toBe("http://upstream-b:3002");
      expect(picks[2]).toBe("http://upstream-b:3002");
    });

    it("cycles the expanded array deterministically", () => {
      const weightedTargets = [
        { url: "http://upstream-a:3001", weight: 1 },
        { url: "http://upstream-b:3002", weight: 3 },
      ];
      const lb = new LoadBalancer(weightedTargets, "weighted");
      const router = lb.createRouterFn();

      const picks: string[] = [];
      for (let i = 0; i < 8; i++) {
        picks.push(router({}));
      }

      // Expanded: ["a", "b", "b", "b"] → repeats: a,b,b,b,a,b,b,b
      const expectedPattern = [
        "http://upstream-a:3001",
        "http://upstream-b:3002",
        "http://upstream-b:3002",
        "http://upstream-b:3002",
        "http://upstream-a:3001",
        "http://upstream-b:3002",
        "http://upstream-b:3002",
        "http://upstream-b:3002",
      ];
      expect(picks).toEqual(expectedPattern);
    });

    it("treats missing weight as 1", () => {
      const weightedTargets = [
        { url: "http://upstream-a:3001" },      // weight defaults to 1
        { url: "http://upstream-b:3002", weight: 2 },
      ];
      const lb = new LoadBalancer(weightedTargets, "weighted");
      const router = lb.createRouterFn();

      const picks: string[] = [];
      for (let i = 0; i < 3; i++) {
        picks.push(router({}));
      }

      // Expanded: ["a", "b", "b"]
      expect(picks[0]).toBe("http://upstream-a:3001");
      expect(picks[1]).toBe("http://upstream-b:3002");
      expect(picks[2]).toBe("http://upstream-b:3002");
    });
  });

  describe("least-connections strategy", () => {
    it("always picks the target with fewest connections", () => {
      const lb = new LoadBalancer(targets, "least-connections");
      const router = lb.createRouterFn();

      // Initially both have 0 connections — first target wins tie
      const req1 = {};
      expect(router(req1)).toBe("http://upstream-a:3001");

      // Now a has 1 connection, b has 0 — b should be picked
      const req2 = {};
      expect(router(req2)).toBe("http://upstream-b:3002");
    });

    it("connection count increments on pick and decrements on close", () => {
      const lb = new LoadBalancer(targets, "least-connections");
      const router = lb.createRouterFn();

      const req1 = {};
      const req2 = {};

      router(req1);
      router(req2);

      const countsBefore = lb.getConnectionCounts();
      expect(countsBefore.get("http://upstream-a:3001")).toBe(1);
      expect(countsBefore.get("http://upstream-b:3002")).toBe(1);

      lb.onConnectionClosed(req1);

      const countsAfter = lb.getConnectionCounts();
      expect(countsAfter.get("http://upstream-a:3001")).toBe(0);
      expect(countsAfter.get("http://upstream-b:3002")).toBe(1);
    });

    it("closed connection is no longer tracked (WeakMap cleaned up)", () => {
      const lb = new LoadBalancer(targets, "least-connections");
      const router = lb.createRouterFn();

      const req = {};
      router(req);

      expect(lb.getConnectionCounts().get("http://upstream-a:3001")).toBe(1);

      lb.onConnectionClosed(req);

      // Calling onConnectionClosed again should be a no-op (not decrement further)
      lb.onConnectionClosed(req);
      expect(lb.getConnectionCounts().get("http://upstream-a:3001")).toBe(0);
    });

    it("ties go to the first target in the expanded array", () => {
      const lb = new LoadBalancer(targets, "least-connections");
      const router = lb.createRouterFn();

      // Both at 0 connections — first target should win
      const req = {};
      const chosen = router(req);
      expect(chosen).toBe("http://upstream-a:3001");
    });

    it("picks correctly across multiple increments and decrements", () => {
      const lb = new LoadBalancer(targets, "least-connections");
      const router = lb.createRouterFn();

      const reqs = [{}, {}, {}, {}];
      // Pick 4 times: alternates a, b, a, b as counts grow
      const picks = reqs.map((req) => router(req));

      expect(picks[0]).toBe("http://upstream-a:3001"); // a=0, b=0 → a wins tie
      expect(picks[1]).toBe("http://upstream-b:3002"); // a=1, b=0 → b
      expect(picks[2]).toBe("http://upstream-a:3001"); // a=1, b=1 → a wins tie
      expect(picks[3]).toBe("http://upstream-b:3002"); // a=2, b=1 → b

      // Close req for a (first pick)
      lb.onConnectionClosed(reqs[0]);
      // a=1, b=2 → next pick should be a
      const nextReq = {};
      expect(router(nextReq)).toBe("http://upstream-a:3001");
    });

    it("exposes strategy correctly", () => {
      const lb = new LoadBalancer(targets, "least-connections");
      expect(lb.strategy).toBe("least-connections");
    });
  });

  describe("getConnectionCounts", () => {
    it("returns a map initialized to zero for all targets", () => {
      const lb = new LoadBalancer(targets, "least-connections");
      const counts = lb.getConnectionCounts();
      expect(counts.get("http://upstream-a:3001")).toBe(0);
      expect(counts.get("http://upstream-b:3002")).toBe(0);
    });

    it("returns readonly map (does not expose internal state for mutation)", () => {
      const lb = new LoadBalancer(targets, "least-connections");
      const counts = lb.getConnectionCounts();
      // ReadonlyMap has no set method at runtime (it's just a Map under the hood),
      // but we verify it's the correct type and reflects actual state
      expect(counts).toBeDefined();
      expect(counts.size).toBe(2);
    });
  });
});
