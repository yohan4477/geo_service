import { randomUUID } from "node:crypto";
import { travelSignalInsightSchema } from "./schema.js";
import type {
  TravelPainpoint,
  TravelJourneyStage,
  TravelSignalEvent,
  TravelSignalInsight,
  TravelSignalReasonerConfig,
} from "./types.js";

const KEYWORD_STAGE_MAP: Array<{ keywords: string[]; stage: TravelJourneyStage }> = [
  { keywords: ["签证", "비자", "visa"], stage: "pre-trip" },
  { keywords: ["입국", "입장", "입국심사", "입항"], stage: "arrival" },
  { keywords: ["地铁", "지하철", "버스", "call taxi"], stage: "in-city" },
  { keywords: ["출국", "귀국", "면세"], stage: "departure" },
];

const KEYWORD_PAINPOINT_MAP: Array<{ keywords: string[]; painpoint: TravelPainpoint }> = [
  { keywords: ["支付", "결제", "pay", "카드"], painpoint: "payment" },
  { keywords: ["排队", "대기", "拥堵", "traffic"], painpoint: "mobility" },
  { keywords: ["信息", "안내", "번역"], painpoint: "information" },
  { keywords: ["安全", "비상", "폭설", "台风"], painpoint: "safety" },
  { keywords: ["购物", "면세", "쇼핑"], painpoint: "shopping" },
  { keywords: ["体验", "맛집", "관광"], painpoint: "experience" },
];

export class JourneyReasoner {
  private readonly config: TravelSignalReasonerConfig;

  constructor(config: TravelSignalReasonerConfig) {
    this.config = config;
  }

  buildInsights(events: TravelSignalEvent[]): TravelSignalInsight[] {
    const insights = events.map((event) => this.toInsight(event)).filter((insight): insight is TravelSignalInsight =>
      Boolean(insight),
    );
    return insights;
  }

  private toInsight(event: TravelSignalEvent): TravelSignalInsight | null {
    const headline = event.title.trim();
    if (!headline) {
      return null;
    }
    const stage = this.resolveStage(event);
    const painpoint = this.resolvePainpoint(event);
    const impact = this.computeImpactScore(event);
    if (impact < this.config.inference.minImpactScore) {
      return null;
    }
    const insight: TravelSignalInsight = {
      id: event.id ?? randomUUID(),
      eventId: event.id ?? randomUUID(),
      headline,
      details: event.summary.trim() || headline,
      stage,
      painpoint,
      impactScore: impact,
      confidence: this.config.inference.defaultConfidence,
      recommendedActions: this.recommendActions(stage, painpoint, event),
      createdAt: new Date().toISOString(),
    };
    const parsed = travelSignalInsightSchema.safeParse(insight);
    return parsed.success ? parsed.data : null;
  }

  private resolveStage(event: TravelSignalEvent): TravelJourneyStage {
    if (event.stage) {
      return event.stage;
    }
    const summary = `${event.title} ${event.summary}`.toLowerCase();
    for (const entry of KEYWORD_STAGE_MAP) {
      if (entry.keywords.some((keyword) => summary.includes(keyword.toLowerCase()))) {
        return entry.stage;
      }
    }
    return "in-city";
  }

  private resolvePainpoint(event: TravelSignalEvent): TravelPainpoint {
    if (event.painpoint) {
      return event.painpoint;
    }
    const summary = `${event.title} ${event.summary}`.toLowerCase();
    for (const entry of KEYWORD_PAINPOINT_MAP) {
      if (entry.keywords.some((keyword) => summary.includes(keyword.toLowerCase()))) {
        return entry.painpoint;
      }
    }
    return "information";
  }

  private computeImpactScore(event: TravelSignalEvent): number {
    const base = event.tags?.includes("alert") ? 0.9 : event.tags?.includes("heads-up") ? 0.6 : 0.4;
    const lengthFactor = Math.min(1, (event.summary.length || 0) / 400);
    const freshnessFactor = resolveFreshness(event.publishedAt);
    return clampScore(base * 0.5 + lengthFactor * 0.2 + freshnessFactor * 0.3);
  }

  private recommendActions(
    stage: TravelJourneyStage,
    painpoint: TravelPainpoint,
    event: TravelSignalEvent,
  ): string[] {
    const hints: string[] = [];
    if (painpoint === "payment") {
      hints.push("준비된 결제 수단(위챗페이/알리페이/현금)을 점검하세요.");
    }
    if (painpoint === "mobility") {
      hints.push("혼잡 시간대에는 지하철/버스 대안을 사전에 확인하세요.");
    }
    if (stage === "arrival") {
      hints.push("입국 시 필요 서류(EVOA/비자/검역)를 재확인하세요.");
    }
    if (event.location) {
      hints.push(`${event.location} 인근 대체 코스를 고려하세요.`);
    }
    return Array.from(new Set(hints));
  }
}

function resolveFreshness(publishedAt: string): number {
  const published = Date.parse(publishedAt);
  if (Number.isNaN(published)) {
    return 0.3;
  }
  const deltaHours = (Date.now() - published) / (1000 * 60 * 60);
  if (deltaHours <= 1) {
    return 1;
  }
  if (deltaHours <= 6) {
    return 0.8;
  }
  if (deltaHours <= 24) {
    return 0.5;
  }
  return 0.2;
}

function clampScore(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}
