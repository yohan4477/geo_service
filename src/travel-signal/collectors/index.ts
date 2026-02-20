import type { TravelSignalCollector, TravelSignalCollectorConfig } from "../types.js";
import { HttpJsonCollector } from "./http-json.js";
import { StaticFileCollector } from "./static-file.js";

export function buildTravelSignalCollectors(configs: TravelSignalCollectorConfig[]): TravelSignalCollector[] {
  return configs.map((config) => createCollector(config));
}

function createCollector(config: TravelSignalCollectorConfig): TravelSignalCollector {
  switch (config.type) {
    case "http-json":
      return new HttpJsonCollector(config);
    case "static-file":
      return new StaticFileCollector(config);
    default:
      throw new Error(`Unsupported collector type ${(config as TravelSignalCollectorConfig).type}`);
  }
}
