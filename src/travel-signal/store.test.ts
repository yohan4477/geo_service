import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TravelSignalStore } from "./store.js";

const tempDir = path.join(os.tmpdir(), "travel-signal-tests");

describe("TravelSignalStore", () => {
  const storePath = path.join(tempDir, "store.json");
  let store: TravelSignalStore;

  beforeEach(async () => {
    await fs.mkdir(tempDir, { recursive: true });
    store = new TravelSignalStore(storePath);
    await store.init();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("persists appended events and insights", async () => {
    const events = await store.appendEvents([
      {
        sourceId: "rss-1",
        title: "면세점 대기 증가",
        summary: "인천공항 면세점 주말 대기 45분",
        publishedAt: new Date().toISOString(),
      },
    ]);

    expect(events).toHaveLength(1);
    await store.upsertInsights([
      {
        id: "insight-1",
        eventId: events[0]!.id,
        headline: "면세점 대기 45분",
        details: "면세점 대기가 길어지고 있습니다.",
        stage: "in-city",
        painpoint: "shopping",
        impactScore: 0.8,
        confidence: 0.7,
        recommendedActions: ["여유 시간을 확보하세요."],
        createdAt: new Date().toISOString(),
      },
    ]);

    const listed = store.listInsights();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.painpoint).toBe("shopping");
  });
});
