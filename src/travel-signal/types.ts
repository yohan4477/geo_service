import type { z } from "zod";
import type { travelSignalConfigSchema, travelSignalEventSchema, travelSignalInsightSchema } from "./schema.js";

export type TravelJourneyStage = "pre-trip" | "arrival" | "in-city" | "departure";

export type TravelPainpoint =
  | "payment"
  | "mobility"
  | "information"
  | "safety"
  | "shopping"
  | "experience";

export type TravelSignalEvent = z.infer<typeof travelSignalEventSchema>;

export type TravelSignalInsight = z.infer<typeof travelSignalInsightSchema>;

export type TravelSignalConfig = z.infer<typeof travelSignalConfigSchema>;

export type TravelSignalCollectorResult = {
  events: TravelSignalEvent[];
};

export type TravelSignalCollectorContext = {
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

export interface TravelSignalCollector {
  readonly id: string;
  collect(context: TravelSignalCollectorContext): Promise<TravelSignalCollectorResult>;
}

export type TravelSignalCollectorConfig =
  | {
      type: "http-json";
      id: string;
      url: string;
      stage?: TravelJourneyStage;
      painpoint?: TravelPainpoint;
      headers?: Record<string, string>;
      map?: {
        title: string;
        summary: string;
        publishedAt?: string;
        location?: string;
        tags?: string;
      };
    }
  | {
      type: "static-file";
      id: string;
      path: string;
      stage?: TravelJourneyStage;
      painpoint?: TravelPainpoint;
    };

export type TravelSignalReasonerConfig = {
  inference: {
    minImpactScore: number;
    defaultConfidence: number;
  };
};

export type TravelSignalServiceDeps = {
  fetchImpl?: typeof fetch;
  logger?: Pick<Console, "log" | "error" | "warn">;
  now?: () => Date;
};
