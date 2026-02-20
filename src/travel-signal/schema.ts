import { z } from "zod";

const JOURNEY_STAGE_VALUES = ["pre-trip", "arrival", "in-city", "departure"] as const;
const PAINPOINT_VALUES = ["payment", "mobility", "information", "safety", "shopping", "experience"] as const;

export const travelSignalEventSchema = z.object({
  id: z.string().optional(),
  sourceId: z.string(),
  title: z.string(),
  summary: z.string(),
  url: z.string().url().optional(),
  stage: z.enum(JOURNEY_STAGE_VALUES).optional(),
  painpoint: z.enum(PAINPOINT_VALUES).optional(),
  location: z.string().optional(),
  tags: z.array(z.string()).optional(),
  publishedAt: z.string().datetime({ offset: true }),
  detectedAt: z.string().datetime({ offset: true }).optional(),
});

export const travelSignalInsightSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  headline: z.string(),
  details: z.string(),
  stage: z.enum(JOURNEY_STAGE_VALUES),
  painpoint: z.enum(PAINPOINT_VALUES),
  impactScore: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  recommendedActions: z.array(z.string()).default([]),
  createdAt: z.string().datetime({ offset: true }),
});

export const travelSignalCollectorConfigSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("http-json"),
    id: z.string(),
    url: z.string().url(),
    stage: z.enum(JOURNEY_STAGE_VALUES).optional(),
    painpoint: z.enum(PAINPOINT_VALUES).optional(),
    headers: z.record(z.string()).optional(),
    map: z
      .object({
        title: z.string(),
        summary: z.string(),
        publishedAt: z.string().optional(),
        location: z.string().optional(),
        tags: z.string().optional(),
      })
      .optional(),
  }),
  z.object({
    type: z.literal("static-file"),
    id: z.string(),
    path: z.string(),
    stage: z.enum(JOURNEY_STAGE_VALUES).optional(),
    painpoint: z.enum(PAINPOINT_VALUES).optional(),
  }),
]);

export const travelSignalReasonerConfigSchema = z.object({
  inference: z.object({
    minImpactScore: z.number().min(0).max(1).default(0.15),
    defaultConfidence: z.number().min(0).max(1).default(0.65),
  }),
});

export const travelSignalConfigSchema = z.object({
  storePath: z.string().optional(),
  collectors: z.array(travelSignalCollectorConfigSchema).default([]),
  reasoner: travelSignalReasonerConfigSchema.default({
    inference: { minImpactScore: 0.15, defaultConfidence: 0.65 },
  }),
});
