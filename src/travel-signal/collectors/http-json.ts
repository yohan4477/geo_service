import { wrapFetchWithAbortSignal } from "../../infra/fetch.js";
import { travelSignalEventSchema } from "../schema.js";
import type {
  TravelSignalCollector,
  TravelSignalCollectorContext,
  TravelSignalCollectorConfig,
  TravelSignalCollectorResult,
  TravelSignalEvent,
} from "../types.js";

export class HttpJsonCollector implements TravelSignalCollector {
  readonly id: string;
  private readonly url: string;
  private readonly defaults: { stage?: string; painpoint?: string };
  private readonly headers?: Record<string, string>;
  private readonly map?: TravelSignalCollectorConfig & { type: "http-json" }["map"];

  constructor(config: Extract<TravelSignalCollectorConfig, { type: "http-json" }>) {
    this.id = config.id;
    this.url = config.url;
    this.defaults = { stage: config.stage, painpoint: config.painpoint };
    this.headers = config.headers;
    this.map = config.map;
  }

  async collect(context: TravelSignalCollectorContext): Promise<TravelSignalCollectorResult> {
    const fetchImpl = resolveFetch(context.fetchImpl);
    const response = await fetchImpl(this.url, {
      headers: this.headers,
    });
    if (!response.ok) {
      throw new Error(`Collector ${this.id} failed with status ${response.status}`);
    }
    const raw = await response.json();
    const normalized = this.normalize(raw);
    return { events: normalized };
  }

  private normalize(payload: unknown): TravelSignalEvent[] {
    if (!Array.isArray(payload)) {
      return [];
    }
    return payload
      .map((entry) => {
        const mapped = this.map ? this.applyMap(entry, this.map) : entry;
        if (!mapped || typeof mapped !== "object") {
          return null;
        }
        const candidate = {
          ...mapped,
          stage: mapped.stage ?? this.defaults.stage,
          painpoint: mapped.painpoint ?? this.defaults.painpoint,
        };
        const parsed = travelSignalEventSchema.safeParse(candidate);
        return parsed.success ? parsed.data : null;
      })
      .filter((event): event is TravelSignalEvent => Boolean(event));
  }

  private applyMap(entry: unknown, map: NonNullable<HttpJsonCollector["map"]>) {
    if (!entry || typeof entry !== "object") {
      return null;
    }
    const source = entry as Record<string, unknown>;
    const tagsValue = map.tags ? source[map.tags] : undefined;
    return {
      sourceId: String(source.id ?? source.guid ?? ""),
      title: String(source[map.title] ?? ""),
      summary: String(source[map.summary] ?? source[map.title] ?? ""),
      url: typeof source.url === "string" ? source.url : undefined,
      stage: source.stage,
      painpoint: source.painpoint,
      location: map.location && typeof source[map.location] === "string" ? String(source[map.location]) : undefined,
      publishedAt: toIsoDate(
        typeof map.publishedAt === "string" && source[map.publishedAt]
          ? String(source[map.publishedAt])
          : new Date().toISOString(),
      ),
      tags: Array.isArray(tagsValue)
        ? tagsValue.map((tag) => String(tag))
        : typeof tagsValue === "string"
          ? tagsValue.split(",").map((tag) => tag.trim()).filter(Boolean)
          : undefined,
    };
  }
}

function resolveFetch(fetchImpl?: typeof fetch): typeof fetch {
  if (fetchImpl) {
    return wrapFetchWithAbortSignal(fetchImpl);
  }
  if (typeof fetch !== "undefined") {
    return wrapFetchWithAbortSignal(fetch);
  }
  throw new Error("Fetch implementation not available for HttpJsonCollector");
}

function toIsoDate(input: string): string {
  const parsed = Date.parse(input);
  if (Number.isNaN(parsed)) {
    return new Date().toISOString();
  }
  return new Date(parsed).toISOString();
}
