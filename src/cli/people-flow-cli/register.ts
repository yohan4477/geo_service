import fs from "node:fs/promises";
import path from "node:path";
import type { Command } from "commander";
import {
  PeopleFlowService,
  loadPeopleFlowConfig,
  loadPeopleFlowLocations,
  snapshotsToGeoJson,
} from "../../people-flow/index.js";
import type { PeopleFlowConfig, PeopleFlowSnapshot } from "../../people-flow/types.js";
import { resolveStateDir } from "../../config/paths.js";
import { ensureDir, pathExists, resolveUserPath } from "../../utils.js";
import { defaultRuntime } from "../../runtime.js";
import { runCommandWithRuntime } from "../cli-utils.js";
import { theme } from "../../terminal/theme.js";
import { formatDocsLink } from "../../terminal/links.js";

type SnapshotFormat = "geojson" | "snapshots";

export function registerPeopleFlowCli(program: Command) {
  const peopleFlow = program
    .command("people-flow")
    .description("Seoul real-time people-flow pipeline")
    .option("-c, --config <path>", "Path to people-flow config JSON")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink(
          "/cli/people-flow",
          "docs.openclaw.ai/cli/people-flow",
        )}\n`,
    );

  peopleFlow
    .command("snapshot")
    .description("Fetch the latest snapshot and optionally export GeoJSON")
    .option("--format <format>", "geojson|snapshots", "geojson")
    .option("--out <path>", "Write output to file (otherwise prints JSON)")
    .option("--pretty", "Pretty-print JSON output", false)
    .action(async (opts, cmd) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        const { service, config, configPath, usingSample } = await createServiceForCommand(cmd);
        const format = normalizeFormat(opts.format);
        const payload =
          format === "snapshots" ? await service.fetchSnapshots() : await service.fetchGeoJson();
        const outputPath = typeof opts.out === "string" ? opts.out : config.outputPath;
        const pretty = Boolean(opts.pretty);
        await emitPayload(payload, { outputPath, pretty });
        if (outputPath) {
          defaultRuntime.log(
            theme.success(
              `Wrote ${format} payload to ${path.resolve(resolveUserPath(outputPath))}${
                usingSample ? " (using sample config)" : ""
              }`,
            ),
          );
        } else {
          defaultRuntime.log(
            theme.muted(
              `Displayed ${format} payload from ${configPath}${usingSample ? " (sample config)" : ""}`,
            ),
          );
        }
      });
    });

  peopleFlow
    .command("locations")
    .description("List configured map points")
    .action(async (_opts, cmd) => {
      await runCommandWithRuntime(defaultRuntime, async () => {
        const { config, configPath, usingSample } = await resolveConfigForCommand(cmd);
        const locations = await loadPeopleFlowLocations(config.locationsPath);
        if (!locations.length) {
          defaultRuntime.log(
            theme.warn(`No locations configured in ${config.locationsPath}. Add entries to proceed.`),
          );
          return;
        }
        defaultRuntime.log(
          theme.heading(
            `Loaded ${locations.length} location${locations.length > 1 ? "s" : ""} from ${
              config.locationsPath
            }${usingSample ? " (sample config)" : ""}`,
          ),
        );
        locations.forEach((loc, index) => {
          defaultRuntime.log(
            `${theme.accent(`#${index + 1}`)} ${loc.name} ${theme.muted(
              `(${loc.district} · ${loc.category ?? "uncategorized"})`,
            )}`,
          );
          defaultRuntime.log(
            theme.muted(
              `    apiName=${loc.apiName} lat=${loc.latitude.toFixed(5)} lng=${loc.longitude.toFixed(5)}`,
            ),
          );
        });
        defaultRuntime.log(theme.muted(`Config: ${configPath}`));
      });
    });
}

async function createServiceForCommand(command: Command) {
  const { config, configPath, usingSample } = await resolveConfigForCommand(command);
  const service = await PeopleFlowService.fromConfig(config, { logger: console });
  return { service, config, configPath, usingSample };
}

async function resolveConfigForCommand(command: Command): Promise<{
  config: PeopleFlowConfig;
  configPath: string;
  usingSample: boolean;
}> {
  const root = resolvePeopleFlowCommand(command);
  const cliOpts = root.opts<{ config?: string }>();
  const requestedPath = resolveConfigPath(cliOpts.config);
  if (await pathExists(requestedPath)) {
    const config = await loadPeopleFlowConfig(requestedPath);
    return { config, configPath: requestedPath, usingSample: false };
  }
  const samplePath = path.resolve("data/people-flow.config.json");
  if (cliOpts.config && !(await pathExists(requestedPath))) {
    throw new Error(`Config file not found: ${requestedPath}`);
  }
  if (await pathExists(samplePath)) {
    const sampleConfig = await loadPeopleFlowConfig(samplePath);
    return { config: sampleConfig, configPath: samplePath, usingSample: true };
  }
  throw new Error(
    `People-flow config missing. Create one at ${requestedPath} (see data/people-flow.config.json for a starter).`,
  );
}

function resolveConfigPath(rawPath?: string): string {
  if (rawPath?.trim()) {
    return resolveUserPath(rawPath);
  }
  const defaultPath = path.join(resolveStateDir(), "people-flow", "config.json");
  return resolveUserPath(defaultPath);
}

function resolvePeopleFlowCommand(command: Command): Command {
  let current: Command | null = command;
  while (current && current.name() !== "people-flow") {
    current = current.parent ?? null;
  }
  return current ?? command;
}

async function emitPayload(
  payload: PeopleFlowSnapshot[] | ReturnType<typeof snapshotsToGeoJson>,
  options: { outputPath?: string; pretty?: boolean },
) {
  const serialized = JSON.stringify(payload, null, options.pretty ? 2 : 0);
  if (!options.outputPath) {
    defaultRuntime.log(serialized);
    return;
  }
  const resolved = resolveUserPath(options.outputPath);
  await ensureDir(path.dirname(resolved));
  await fs.writeFile(resolved, `${serialized}\n`, "utf8");
}

function normalizeFormat(value?: string): SnapshotFormat {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "snapshots") {
    return "snapshots";
  }
  return "geojson";
}
