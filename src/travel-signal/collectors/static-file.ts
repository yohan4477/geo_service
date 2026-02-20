import fs from "node:fs/promises";
import path from "node:path";
import { resolveUserPath } from "../../utils.js";
import { travelSignalEventSchema } from "../schema.js";
import type {
  TravelSignalCollector,
  TravelSignalCollectorContext,
  TravelSignalCollectorConfig,
  TravelSignalCollectorResult,
  TravelSignalEvent,
} from "../types.js";

export class StaticFileCollector implements TravelSignalCollector {
  readonly id: string;
  private readonly filePath: string;
  private readonly defaults: { stage?: string; painpoint?: string };

  constructor(config: Extract<TravelSignalCollectorConfig, { type: "static-file" }>) {
    this.id = config.id;
    this.filePath = resolveUserPath(config.path);
    this.defaults = { stage: config.stage, painpoint: config.painpoint };
  }

  async collect(_context: TravelSignalCollectorContext): Promise<TravelSignalCollectorResult> {
    const resolved = path.resolve(this.filePath);
    const raw = await fs.readFile(resolved, "utf8");
    const data = JSON.parse(raw) as unknown;
    const normalized = this.normalize(data);
    return { events: normalized };
  }

  private normalize(payload: unknown): TravelSignalEvent[] {
    if (!Array.isArray(payload)) {
      return [];
    }
    return payload
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }
        const candidate = {
          ...entry,
          stage: entry.stage ?? this.defaults.stage,
          painpoint: entry.painpoint ?? this.defaults.painpoint,
        };
        const parsed = travelSignalEventSchema.safeParse(candidate);
        return parsed.success ? parsed.data : null;
      })
      .filter((event): event is TravelSignalEvent => Boolean(event));
  }
}
