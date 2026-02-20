import { describe, expect, it } from "vitest";
import { JourneyReasoner } from "./reasoner.js";

const baseEvent = {
  sourceId: "test",
  title: "홍대 쇼핑 거리 대기 2시간",
  summary: "샤오홍슈에서 홍대 쇼핑 거리 주말 대기 2시간 경고",
  publishedAt: new Date().toISOString(),
};

describe("JourneyReasoner", () => {
  it("creates insights above the configured impact threshold", () => {
    const reasoner = new JourneyReasoner({
      inference: { minImpactScore: 0.1, defaultConfidence: 0.5 },
    });

    const insights = reasoner.buildInsights([baseEvent]);
    expect(insights).toHaveLength(1);
    expect(insights[0]?.stage).toBe("in-city");
    expect(insights[0]?.painpoint).toBe("mobility");
  });

  it("returns empty array when events do not meet impact threshold", () => {
    const reasoner = new JourneyReasoner({
      inference: { minImpactScore: 0.95, defaultConfidence: 0.5 },
    });
    const insights = reasoner.buildInsights([baseEvent]);
    expect(insights).toHaveLength(0);
  });
});
