import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ensureDir, resolveUserPath } from "../utils.js";
import { travelSignalEventSchema, travelSignalInsightSchema } from "./schema.js";
import type { TravelSignalInsight, TravelSignalEvent, TravelJourneyStage, TravelPainpoint } from "./types.js";

type PersistedTravelSignalData = {
  events: TravelSignalEventRecord[];
  insights: TravelSignalInsight[];
};

type TravelSignalEventRecord = TravelSignalEvent & { id: string; detectedAt: string };

type ListInsightsFilter = {
  stage?: TravelJourneyStage;
  painpoint?: TravelPainpoint;
  limit?: number;
};

export class TravelSignalStore {
  private readonly storePath: string;
  private data: PersistedTravelSignalData = { events: [], insights: [] };

  constructor(filePath: string) {
    this.storePath = resolveUserPath(filePath);
  }

  async init() {
    await ensureDir(path.dirname(this.storePath));
    await this.load();
  }

  async appendEvents(events: TravelSignalEvent[]): Promise<TravelSignalEventRecord[]> {
    const normalized = events
      .map((event) => {
        const parsed = travelSignalEventSchema.safeParse(event);
        if (!parsed.success) {
          return null;
        }
        const detectedAt = event.detectedAt ?? new Date().toISOString();
        return { ...parsed.data, id: parsed.data.id ?? randomUUID(), detectedAt };
      })
      .filter((event): event is TravelSignalEventRecord => Boolean(event));
    if (!normalized.length) {
      return [];
    }
    this.data.events.push(...normalized);
    await this.persist();
    return normalized;
  }

  async upsertInsights(insights: TravelSignalInsight[]) {
    const valid = insights
      .map((insight) => travelSignalInsightSchema.safeParse(insight))
      .filter((parsed): parsed is { success: true; data: TravelSignalInsight } => parsed.success)
      .map((parsed) => parsed.data);
    for (const insight of valid) {
      const existingIndex = this.data.insights.findIndex((entry) => entry.id === insight.id);
      if (existingIndex >= 0) {
        this.data.insights[existingIndex] = insight;
      } else {
        this.data.insights.push(insight);
      }
    }
    await this.persist();
  }

  listInsights(filter?: ListInsightsFilter): TravelSignalInsight[] {
    const now = Date.now();
    const filtered = this.data.insights.filter((insight) => {
      if (filter?.stage && insight.stage !== filter.stage) {
        return false;
      }
      if (filter?.painpoint && insight.painpoint !== filter.painpoint) {
        return false;
      }
      const createdTime = Date.parse(insight.createdAt);
      const isExpired = Number.isFinite(createdTime) && now - createdTime > 1000 * 60 * 60 * 24 * 3;
      return !isExpired;
    });
    if (filter?.limit && filter.limit > 0) {
      return filtered.slice(0, filter.limit);
    }
    return filtered;
  }

  listEvents(): TravelSignalEventRecord[] {
    return [...this.data.events];
  }

  private async load() {
    try {
      const raw = await fs.promises.readFile(this.storePath, "utf8");
      const parsed = JSON.parse(raw) as PersistedTravelSignalData;
      this.data = {
        events: Array.isArray(parsed.events) ? parsed.events : [],
        insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        this.data = { events: [], insights: [] };
        return;
      }
      throw error;
    }
  }

  private async persist() {
    const payload: PersistedTravelSignalData = {
      events: this.data.events,
      insights: this.data.insights,
    };
    await fs.promises.writeFile(this.storePath, JSON.stringify(payload, null, 2), "utf8");
  }
}
