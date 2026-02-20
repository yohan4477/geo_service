import { resolveFetch } from "../infra/fetch.js";
import type { PeopleFlowReading } from "./types.js";
import { normalizeCityDataRow, type SeoulCityDataRow } from "./normalize.js";

const BASE_URL = "http://openapi.seoul.go.kr:8088";

type SeoulCityDataResponse = {
  "SeoulRtd.citydata"?: {
    RESULT?: { CODE?: string; MESSAGE?: string };
    list_total_count?: number;
    row?: SeoulCityDataRow[];
  };
  CITYDATA?: SeoulCityDataRow;
  RESULT?: {
    CODE?: string;
    MESSAGE?: string;
    "RESULT.CODE"?: string;
    "RESULT.MESSAGE"?: string;
  };
};

export type SeoulCityDataClientOptions = {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export class SeoulCityDataClient {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: SeoulCityDataClientOptions) {
    if (!options.apiKey?.trim()) {
      throw new Error("SeoulCityDataClient requires an API key");
    }
    const resolvedFetch = resolveFetch(options.fetchImpl);
    if (!resolvedFetch) {
      throw new Error("Fetch implementation not available for SeoulCityDataClient");
    }
    this.apiKey = options.apiKey.trim();
    this.fetchImpl = resolvedFetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async fetchReading(areaName: string): Promise<PeopleFlowReading | null> {
    const trimmed = areaName.trim();
    if (!trimmed) {
      return null;
    }
    const response = await this.fetchWithTimeout(trimmed);
    if (!response.ok) {
      const message = await safeReadResponseText(response);
      throw new Error(
        `Seoul citydata API failed for "${trimmed}" with ${response.status}: ${message}`,
      );
    }
    const payload = (await response.json()) as SeoulCityDataResponse;
    const normalized = this.normalizePayload(payload);
    if (!normalized) {
      return null;
    }
    return normalized;
  }

  private async fetchWithTimeout(areaName: string) {
    const encoded = encodeURIComponent(areaName);
    const url = `${BASE_URL}/${this.apiKey}/json/citydata/1/5/${encoded}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    if (typeof (timer as NodeJS.Timeout).unref === "function") {
      (timer as NodeJS.Timeout).unref();
    }
    try {
      return await this.fetchImpl(url, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private normalizePayload(payload: SeoulCityDataResponse): PeopleFlowReading | null {
    // Case 1: SeoulRtd.citydata (older or specific response format)
    const root = payload?.["SeoulRtd.citydata"];
    if (root) {
      const resultCode = root.RESULT?.CODE;
      if (resultCode && resultCode !== "INFO-000") {
        const message = root.RESULT?.MESSAGE ?? "Unknown error";
        throw new Error(`Seoul citydata API error ${resultCode}: ${message}`);
      }
      const row = Array.isArray(root.row) ? root.row[0] : undefined;
      if (row) {
        return normalizeCityDataRow(row);
      }
    }

    // Case 2: CITYDATA (newer or direct citydata service format)
    if (payload?.CITYDATA) {
      const result = payload.RESULT;
      const resultCode = result?.CODE || result?.["RESULT.CODE"];
      if (resultCode && resultCode !== "INFO-000") {
        const message = result?.MESSAGE || result?.["RESULT.MESSAGE"] || "Unknown error";
        throw new Error(`Seoul citydata API error ${resultCode}: ${message}`);
      }
      return normalizeCityDataRow(payload.CITYDATA);
    }

    return null;
  }
}

async function safeReadResponseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
