import { describe, expect, it } from "vitest";
import samplePayload from "./__fixtures__/citydata-sample.json";
import { normalizeCityDataRow, type SeoulCityDataRow } from "./normalize.js";

describe("normalizeCityDataRow", () => {
  it("converts a raw Seoul citydata row into a reading", () => {
    const row = (samplePayload?.["SeoulRtd.citydata"]?.row?.[0] ?? null) as SeoulCityDataRow | null;
    expect(row).toBeTruthy();
    const reading = normalizeCityDataRow(row as SeoulCityDataRow);
    expect(reading).toBeTruthy();
    expect(reading?.areaId).toBe("POI_001");
    expect(reading?.populationMin).toBe(8900);
    expect(reading?.populationMax).toBe(13200);
    expect(reading?.population.maleRate).toBeCloseTo(48.3);
    expect(reading?.population.ageRates?.["30s"]).toBeCloseTo(17.8);
    expect(reading?.samples).toHaveLength(2);
    expect(reading?.samples[0]?.timestamp).toBe("2026-02-19T09:00:00.000Z");
  });

  it("returns null when area name missing", () => {
    const emptyRow: SeoulCityDataRow = {};
    expect(normalizeCityDataRow(emptyRow)).toBeNull();
  });
});
