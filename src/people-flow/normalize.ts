import type { PeopleFlowLiveSample, PeopleFlowPopulationBreakdown, PeopleFlowReading } from "./types.js";

export type SeoulCityDataLiveEntry = {
  PPLTN_TIME?: string;
  AREA_PPLTN?: number | string;
  AREA_CONGEST_LVL?: string;
  AREA_CONGEST_MSG?: string;
  PPLTN_MIN?: number | string;
  PPLTN_MAX?: number | string;
  AREA_PPLTN_MIN?: number | string;
  AREA_PPLTN_MAX?: number | string;
  MALE_PPLTN_RATE?: number | string;
  FEMALE_PPLTN_RATE?: number | string;
  PPLTN_RATE_0?: number | string;
  PPLTN_RATE_10?: number | string;
  PPLTN_RATE_20?: number | string;
  PPLTN_RATE_30?: number | string;
  PPLTN_RATE_40?: number | string;
  PPLTN_RATE_50?: number | string;
  PPLTN_RATE_60?: number | string;
  PPLTN_RATE_70?: number | string;
};

export type SeoulCityDataRow = {
  AREA_NM?: string;
  AREA_CD?: string;
  AREA_CONGEST_LVL?: string;
  AREA_CONGEST_MSG?: string;
  AREA_PPLTN_MIN?: number | string;
  AREA_PPLTN_MAX?: number | string;
  MALE_PPLTN_RATE?: number | string;
  FEMALE_PPLTN_RATE?: number | string;
  PPLTN_RATE_0?: number | string;
  PPLTN_RATE_10?: number | string;
  PPLTN_RATE_20?: number | string;
  PPLTN_RATE_30?: number | string;
  PPLTN_RATE_40?: number | string;
  PPLTN_RATE_50?: number | string;
  PPLTN_RATE_60?: number | string;
  PPLTN_RATE_70?: number | string;
  ROAD_TRAFFIC_IDX?: number | string;
  ROAD_TRAFFIC_SPD?: number | string;
  ROAD_TRAFFIC_MSG?: string;
  LIVE_PPLTN_STTS?: SeoulCityDataLiveEntry[] | Record<string, SeoulCityDataLiveEntry[]>;
};

export function normalizeCityDataRow(row: SeoulCityDataRow): PeopleFlowReading | null {
  const areaName = typeof row.AREA_NM === "string" ? row.AREA_NM.trim() : "";
  if (!areaName) {
    return null;
  }
  const areaId = resolveAreaId(row);
  const liveRaw = row.LIVE_PPLTN_STTS;
  const liveEntries = Array.isArray(liveRaw)
    ? liveRaw
    : liveRaw && typeof liveRaw === "object"
      ? Object.values(liveRaw).flatMap((v) => (Array.isArray(v) ? v : []))
      : [];
  const firstLive = liveEntries[0] || {};

  const samples = normalizeLiveSamples(liveEntries);
  const population: PeopleFlowPopulationBreakdown = {
    maleRate: toNumber(row.MALE_PPLTN_RATE ?? firstLive.MALE_PPLTN_RATE),
    femaleRate: toNumber(row.FEMALE_PPLTN_RATE ?? firstLive.FEMALE_PPLTN_RATE),
    ageRates: {
      "0s": toNumber(row.PPLTN_RATE_0 ?? firstLive.PPLTN_RATE_0),
      "10s": toNumber(row.PPLTN_RATE_10 ?? firstLive.PPLTN_RATE_10),
      "20s": toNumber(row.PPLTN_RATE_20 ?? firstLive.PPLTN_RATE_20),
      "30s": toNumber(row.PPLTN_RATE_30 ?? firstLive.PPLTN_RATE_30),
      "40s": toNumber(row.PPLTN_RATE_40 ?? firstLive.PPLTN_RATE_40),
      "50s": toNumber(row.PPLTN_RATE_50 ?? firstLive.PPLTN_RATE_50),
      "60s": toNumber(row.PPLTN_RATE_60 ?? firstLive.PPLTN_RATE_60),
      "70s": toNumber(row.PPLTN_RATE_70 ?? firstLive.PPLTN_RATE_70),
    },
  };

  return {
    areaId,
    areaName,
    areaCode: typeof row.AREA_CD === "string" ? row.AREA_CD.trim() || undefined : undefined,
    congestionLevel:
      typeof (row.AREA_CONGEST_LVL ?? firstLive.AREA_CONGEST_LVL) === "string"
        ? (row.AREA_CONGEST_LVL ?? firstLive.AREA_CONGEST_LVL)
        : undefined,
    congestionMessage:
      typeof (row.AREA_CONGEST_MSG ?? firstLive.AREA_CONGEST_MSG) === "string"
        ? (row.AREA_CONGEST_MSG ?? firstLive.AREA_CONGEST_MSG)
        : undefined,
    populationMin: toNumber(row.AREA_PPLTN_MIN ?? firstLive.AREA_PPLTN_MIN),
    populationMax: toNumber(row.AREA_PPLTN_MAX ?? firstLive.AREA_PPLTN_MAX),
    lastUpdated: samples[0]?.timestamp,
    samples,
    population,
    traffic: {
      index: toNumber(row.ROAD_TRAFFIC_IDX),
      speedKph: toNumber(row.ROAD_TRAFFIC_SPD),
      message: typeof row.ROAD_TRAFFIC_MSG === "string" ? row.ROAD_TRAFFIC_MSG : undefined,
    },
  };
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const normalized = Number.parseFloat(value.replace(/,/g, ""));
    if (Number.isFinite(normalized)) {
      return normalized;
    }
  }
  return null;
}

function normalizeLiveSamples(entries: SeoulCityDataLiveEntry[]): PeopleFlowLiveSample[] {
  return entries
    .map((entry) => {
      const timestamp =
        typeof entry.PPLTN_TIME === "string" ? new Date(entry.PPLTN_TIME).toISOString() : null;
      if (!timestamp) {
        return null;
      }
      return {
        timestamp,
        population: toNumber(entry.AREA_PPLTN),
        congestionLevel:
          typeof entry.AREA_CONGEST_LVL === "string" ? entry.AREA_CONGEST_LVL : undefined,
        congestionMessage:
          typeof entry.AREA_CONGEST_MSG === "string" ? entry.AREA_CONGEST_MSG : undefined,
        populationMin: toNumber(entry.AREA_PPLTN_MIN ?? entry.PPLTN_MIN),
        populationMax: toNumber(entry.AREA_PPLTN_MAX ?? entry.PPLTN_MAX),
      } satisfies PeopleFlowLiveSample;
    })
    .filter((sample): sample is PeopleFlowLiveSample => Boolean(sample));
}

function resolveAreaId(row: SeoulCityDataRow): string {
  if (typeof row.AREA_CD === "string" && row.AREA_CD.trim()) {
    return row.AREA_CD.trim();
  }
  return encodeURIComponent((row.AREA_NM ?? "").trim()).replace(/%/g, "").toLowerCase();
}
