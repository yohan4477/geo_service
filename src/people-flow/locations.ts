import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { resolveUserPath } from "../utils.js";
import type { PeopleFlowLocation } from "./types.js";

const peopleFlowLocationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  district: z.string().min(1),
  category: z.string().optional(),
  apiName: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
});

const peopleFlowLocationListSchema = z.array(peopleFlowLocationSchema);

export async function loadPeopleFlowLocations(filePath: string): Promise<PeopleFlowLocation[]> {
  const resolved = resolveUserPath(filePath);
  const absolute = path.resolve(resolved);
  const raw = await fs.readFile(absolute, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const result = peopleFlowLocationListSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid location file ${absolute}: ${result.error.message}`);
  }
  return result.data;
}
