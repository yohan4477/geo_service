import fs from "node:fs/promises";
import path from "node:path";
import { loadPeopleFlowLocations } from "./locations.js";
import { snapshotsToGeoJson } from "./geojson.js";
import { SeoulCityDataClient } from "./seoul-client.js";
import type {
  GeoJsonFeatureCollection,
  PeopleFlowConfig,
  PeopleFlowLocation,
  PeopleFlowSnapshot,
} from "./types.js";
import { resolveUserPath } from "../utils.js";

export type PeopleFlowServiceDeps = {
  fetchImpl?: typeof fetch;
  logger?: Pick<Console, "log" | "warn" | "error">;
};

type PeopleFlowServiceOptions = {
  apiKey: string;
  locations: PeopleFlowLocation[];
  fetchImpl?: typeof fetch;
  concurrency?: number;
  logger?: Pick<Console, "log" | "warn" | "error">;
};

export class PeopleFlowService {
  private readonly locations: PeopleFlowLocation[];
  private readonly client: SeoulCityDataClient;
  private readonly concurrency: number;
  private readonly logger?: Pick<Console, "log" | "warn" | "error">;

  private constructor(options: PeopleFlowServiceOptions) {
    this.locations = options.locations;
    this.client = new SeoulCityDataClient({
      apiKey: options.apiKey,
      fetchImpl: options.fetchImpl,
    });
    this.concurrency = Math.max(1, options.concurrency ?? 3);
    this.logger = options.logger;
  }

  static async fromConfig(
    config: PeopleFlowConfig,
    deps: PeopleFlowServiceDeps = {},
  ): Promise<PeopleFlowService> {
    const locations = await loadPeopleFlowLocations(config.locationsPath);
    const apiKey = resolveApiKey(config.apiKey);
    if (!apiKey) {
      throw new Error(
        "Missing SEOUL_OPEN_DATA_API_KEY. Set it in your environment or people-flow config.",
      );
    }
    return new PeopleFlowService({
      apiKey,
      locations,
      fetchImpl: deps.fetchImpl,
      concurrency: 4,
      logger: deps.logger,
    });
  }

  async fetchSnapshots(): Promise<PeopleFlowSnapshot[]> {
    const results: PeopleFlowSnapshot[] = [];
    await runWithConcurrency(this.locations, this.concurrency, async (location) => {
      try {
        const reading = await this.client.fetchReading(location.apiName);
        if (reading) {
          results.push({ location, reading });
        }
      } catch (error) {
        this.logger?.warn?.(
          `[people-flow] Failed to fetch ${location.apiName}: ${(error as Error).message}`,
        );
      }
    });
    return results.sort((a, b) => a.location.name.localeCompare(b.location.name));
  }

  async fetchGeoJson(): Promise<GeoJsonFeatureCollection> {
    const snapshots = await this.fetchSnapshots();
    return snapshotsToGeoJson(snapshots);
  }
}

export async function loadPeopleFlowConfig(configPath: string): Promise<PeopleFlowConfig> {
  const resolved = resolveUserPath(configPath);
  const absolute = path.resolve(resolved);
  const raw = await fs.readFile(absolute, "utf8");
  const parsed = JSON.parse(raw) as PeopleFlowConfig;
  if (!parsed.locationsPath) {
    throw new Error(`People flow config at ${absolute} must include locationsPath`);
  }
  return parsed;
}

function resolveApiKey(explicit?: string): string | null {
  return explicit?.trim() || process.env.SEOUL_OPEN_DATA_API_KEY?.trim() || null;
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
) {
  const queue = [...items];
  const workers: Array<Promise<void>> = [];
  for (let i = 0; i < Math.min(limit, queue.length); i += 1) {
    workers.push(spawnWorker(queue, worker));
  }
  await Promise.all(workers);
}

async function spawnWorker<T>(queue: T[], worker: (item: T) => Promise<void>) {
  while (queue.length) {
    const next = queue.shift();
    if (!next) {
      return;
    }
    await worker(next);
  }
}
