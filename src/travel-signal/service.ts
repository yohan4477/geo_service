import path from "node:path";
import { randomUUID } from "node:crypto";
import { buildTravelSignalCollectors } from "./collectors/index.js";
import { travelSignalConfigSchema } from "./schema.js";
import { JourneyReasoner } from "./reasoner.js";
import { TravelSignalStore } from "./store.js";
import type {
  TravelSignalCollectorConfig,
  TravelSignalConfig,
  TravelSignalServiceDeps,
  TravelSignalInsight,
  TravelSignalEvent,
} from "./types.js";
import { resolveStateDir } from "../config/paths.js";

type TravelSignalServiceOptions = {
  config?: TravelSignalConfig;
  collectors?: TravelSignalCollectorConfig[];
};

export class TravelSignalService {
  private readonly store: TravelSignalStore;
  private readonly collectors: ReturnType<typeof buildTravelSignalCollectors>;
  private readonly reasoner: JourneyReasoner;
  private readonly deps: TravelSignalServiceDeps;

  private constructor(params: {
    store: TravelSignalStore;
    collectors: ReturnType<typeof buildTravelSignalCollectors>;
    reasoner: JourneyReasoner;
    deps: TravelSignalServiceDeps;
  }) {
    this.store = params.store;
    this.collectors = params.collectors;
    this.reasoner = params.reasoner;
    this.deps = params.deps;
  }

  static async create(options: TravelSignalServiceOptions = {}, deps: TravelSignalServiceDeps = {}) {
    const normalizedConfig = travelSignalConfigSchema.parse({
      storePath: options.config?.storePath,
      collectors: options.config?.collectors ?? options.collectors ?? [],
      reasoner: options.config?.reasoner,
    });
    const storePath =
      normalizedConfig.storePath ?? path.join(resolveStateDir(), "travel-signal", "signals.json");
    const store = new TravelSignalStore(storePath);
    await store.init();
    const collectors = buildTravelSignalCollectors(normalizedConfig.collectors);
    const reasoner = new JourneyReasoner(normalizedConfig.reasoner);
    return new TravelSignalService({ store, collectors, reasoner, deps });
  }

  async ingest(): Promise<TravelSignalInsight[]> {
    const collectedEvents: TravelSignalEvent[] = [];
    for (const collector of this.collectors) {
      try {
        const result = await collector.collect({
          fetchImpl: this.deps.fetchImpl,
          now: this.deps.now,
        });
        collectedEvents.push(...result.events);
      } catch (error) {
        this.deps.logger?.error?.(`[travel-signal] Collector ${collector.id} failed`, error);
      }
    }
    if (!collectedEvents.length) {
      return [];
    }
    const storedEvents = await this.store.appendEvents(collectedEvents);
    const insights = this.reasoner.buildInsights(storedEvents);
    const normalized = insights.map((insight) => ({
      ...insight,
      id: insight.id || randomUUID(),
      createdAt: new Date().toISOString(),
    }));
    await this.store.upsertInsights(normalized);
    return normalized;
  }

  listInsights(filter?: { stage?: string; painpoint?: string; limit?: number }): TravelSignalInsight[] {
    return this.store.listInsights(filter);
  }

  listEvents(): TravelSignalEvent[] {
    return this.store.listEvents();
  }
}
