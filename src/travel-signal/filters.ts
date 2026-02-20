import type { TravelJourneyStage, TravelPainpoint } from "./types.js";

const STAGES: TravelJourneyStage[] = ["pre-trip", "arrival", "in-city", "departure"];
const PAINPOINTS: TravelPainpoint[] = [
  "payment",
  "mobility",
  "information",
  "safety",
  "shopping",
  "experience",
];

export function normalizeJourneyStage(value?: string): TravelJourneyStage | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.toLowerCase().trim() as TravelJourneyStage;
  return STAGES.includes(normalized) ? normalized : undefined;
}

export function normalizePainpoint(value?: string): TravelPainpoint | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.toLowerCase().trim() as TravelPainpoint;
  return PAINPOINTS.includes(normalized) ? normalized : undefined;
}
