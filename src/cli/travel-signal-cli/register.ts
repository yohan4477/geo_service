import fs from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import { TravelSignalService } from "../../travel-signal/index.js";
import type {
  TravelSignalConfig,
  TravelSignalInsight,
  TravelJourneyStage,
  TravelPainpoint,
} from "../../travel-signal/types.js";
import { travelSignalConfigSchema } from "../../travel-signal/schema.js";
import { resolveStateDir } from "../../config/paths.js";
import { pathExists, resolveUserPath } from "../../utils.js";
import { defaultRuntime } from "../../runtime.js";
import { runCommandWithRuntime } from "../cli-utils.js";
import { theme } from "../../terminal/theme.js";
import { formatDocsLink } from "../../terminal/links.js";
import { normalizeJourneyStage, normalizePainpoint } from "../../travel-signal/filters.js";
import { startTravelSignalDashboardServer } from "../../travel-signal/dashboard-server.js";

export function registerTravelSignalCli(program: Command) {
  const travel = program
    .command("travel-signal")
    .description("Manage the travel AI Signal pipeline (collectors + reasoner)")
    .option("-c, --config <path>", "Path to travel signal config JSON")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink(
          "/cli/travel-signal",
          "docs.openclaw.ai/cli/travel-signal",
        )}\n`,
    );

  travel
    .command("ingest")
    .description("Run collectors + reasoner once and persist insights")
    .action(async (_opts, cmd) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        const { service, config, configPath } = await createServiceForCommand(cmd);
        if (config.collectors.length === 0) {
          defaultRuntime.log(
            theme.warn(
              `No collectors configured. Edit ${configPath} or pass --config to add sources before running ingest.`,
            ),
          );
        }
        const insights = await service.ingest();
        if (!insights.length) {
          defaultRuntime.log(theme.muted("No new insights were generated."));
          return;
        }
        defaultRuntime.log(
          theme.heading(`Generated ${insights.length} insight${insights.length > 1 ? "s" : ""}:`),
        );
        printInsights(insights);
      });
    });

  travel
    .command("list")
    .description("List stored travel insights")
    .option("--stage <stage>", "Filter by journey stage (pre-trip|arrival|in-city|departure)")
    .option(
      "--painpoint <painpoint>",
      "Filter by painpoint (payment|mobility|information|safety|shopping|experience)",
    )
    .option("--limit <n>", "Maximum entries to show", parsePositiveInt)
    .option("--json", "Output JSON", false)
    .action(async (opts, cmd) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        const { service } = await createServiceForCommand(cmd);
        const stage = parseStage(opts.stage);
        const painpoint = parsePainpoint(opts.painpoint);
        const limit = typeof opts.limit === "number" ? opts.limit : undefined;
        const insights = service.listInsights({ stage, painpoint, limit });
        if (opts.json) {
          defaultRuntime.log(JSON.stringify(insights, null, 2));
          return;
        }
        if (!insights.length) {
          defaultRuntime.log(theme.muted("No insights found for the given filters."));
          return;
        }
        printInsights(insights);
      });
    });

  travel
    .command("events")
    .description("Inspect raw ingested events (debug helper)")
    .option("--limit <n>", "Maximum events to show", parsePositiveInt)
    .action(async (opts, cmd) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        const { service } = await createServiceForCommand(cmd);
        const events = service.listEvents();
        const subset = typeof opts.limit === "number" ? events.slice(0, opts.limit) : events;
        if (!subset.length) {
          defaultRuntime.log(theme.muted("No events have been ingested yet."));
          return;
        }
        subset.forEach((event, index) => {
          defaultRuntime.log(
            `${theme.heading(`#${index + 1}`)} ${event.title} ${theme.muted(
              `(${event.stage ?? "stage?"} · ${event.painpoint ?? "painpoint?"})`,
            )}`,
          );
          defaultRuntime.log(`   ${event.summary}`);
          if (event.url) {
            defaultRuntime.log(theme.muted(`   ${event.url}`));
          }
          defaultRuntime.log(
            theme.muted(
              `   detected ${event.detectedAt ?? "unknown"} | published ${event.publishedAt}`,
            ),
          );
        });
      });
    });

  travel
    .command("serve")
    .description("Start a local Travel Signal dashboard web server")
    .option("--host <host>", "Host interface to bind", "127.0.0.1")
    .option("--port <port>", "Port to listen on", parsePositiveInt, 4175)
    .option(
      "--refresh-interval <ms>",
      "Auto-ingest interval in ms (default: 15 minutes)",
      parsePositiveInt,
    )
    .option("--no-auto-ingest", "Disable background ingestion timer", false)
    .option("--ingest-on-start", "Trigger ingest immediately after boot", true)
    .action(async (opts, cmd) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        const { config } = await createServiceForCommand(cmd);
        const refreshInterval =
          typeof opts.refreshInterval === "number" && opts.refreshInterval > 0
            ? opts.refreshInterval
            : 15 * 60 * 1000;
        const autoIngest = opts.autoIngest !== false;
        const ingestOnStart = opts.ingestOnStart !== false;
        const server = await startTravelSignalDashboardServer({
          host: typeof opts.host === "string" ? opts.host : "127.0.0.1",
          port: typeof opts.port === "number" ? opts.port : 4175,
          refreshIntervalMs: refreshInterval,
          autoIngest,
          ingestOnStart,
          config,
          logger: defaultRuntime,
        });
        defaultRuntime.log(
          theme.success(`Travel Signal dashboard is running at ${server.url}`),
        );
      });
    });
}

async function createServiceForCommand(command: Command) {
  const travelRoot = resolveTravelCommand(command);
  const cliOpts = travelRoot.opts<{ config?: string }>();
  const configPath = resolveConfigPath(cliOpts.config);
  const config = await loadTravelSignalConfig(configPath);
  const service = await TravelSignalService.create({ config }, { logger: console });
  return { service, config, configPath };
}

async function loadTravelSignalConfig(configPath: string): Promise<TravelSignalConfig> {
  const exists = await pathExists(configPath);
  if (!exists) {
    return travelSignalConfigSchema.parse({});
  }
  const raw = await fs.readFile(configPath, "utf8");
  const parsed = JSON.parse(raw);
  return travelSignalConfigSchema.parse(parsed);
}

function resolveConfigPath(rawPath?: string): string {
  const defaultPath = path.join(resolveStateDir(), "travel-signal", "config.json");
  return resolveUserPath(rawPath?.trim() ? rawPath : defaultPath);
}

function resolveTravelCommand(command: Command): Command {
  let current: Command | undefined = command;
  while (current && current.name() !== "travel-signal") {
    current = current.parent ?? undefined;
  }
  return current ?? command;
}

const parseStage = normalizeJourneyStage;
const parsePainpoint = normalizePainpoint;

function parsePositiveInt(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function printInsights(insights: TravelSignalInsight[]) {
  insights.forEach((insight, index) => {
    defaultRuntime.log(
      `${theme.heading(`#${index + 1}`)} ${insight.headline} ${theme.muted(
        `(${insight.stage} · ${insight.painpoint})`,
      )}`,
    );
    defaultRuntime.log(`   ${insight.details}`);
    defaultRuntime.log(
      theme.muted(
        `   impact ${(insight.impactScore * 100).toFixed(0)} · confidence ${(insight.confidence * 100).toFixed(0)} · created ${insight.createdAt}`,
      ),
    );
    if (insight.recommendedActions.length) {
      insight.recommendedActions.forEach((action) => {
        defaultRuntime.log(`   - ${action}`);
      });
    }
  });
}
