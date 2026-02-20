export type PeopleFlowLocation = {
  /**
   * Local identifier used by the web app or downstream APIs.
   */
  id: string;
  /**
   * Human friendly name (can include Korean characters).
   */
  name: string;
  /**
   * Administrative district or higher level grouping (e.g., 종로구).
   */
  district: string;
  /**
   * Optional semantic grouping to drive theming on the map.
   */
  category?: string;
  /**
   * String that must match the AREA_NM field in the Seoul citydata API.
   */
  apiName: string;
  /**
   * Latitude + longitude for GeoJSON output.
   */
  latitude: number;
  longitude: number;
};

export type PeopleFlowLiveSample = {
  timestamp: string;
  population: number | null;
  congestionLevel?: string;
  congestionMessage?: string;
  populationMin?: number | null;
  populationMax?: number | null;
};

export type PeopleFlowTrafficStat = {
  index?: number | null;
  speedKph?: number | null;
  message?: string;
};

export type PeopleFlowPopulationBreakdown = {
  maleRate?: number | null;
  femaleRate?: number | null;
  ageRates?: Partial<Record<"0s" | "10s" | "20s" | "30s" | "40s" | "50s" | "60s" | "70s", number | null>>;
};

export type PeopleFlowReading = {
  areaId: string;
  areaName: string;
  areaCode?: string;
  congestionLevel?: string;
  congestionMessage?: string;
  populationMin?: number | null;
  populationMax?: number | null;
  lastUpdated?: string;
  samples: PeopleFlowLiveSample[];
  population: PeopleFlowPopulationBreakdown;
  traffic: PeopleFlowTrafficStat;
};

export type PeopleFlowSnapshot = {
  location: PeopleFlowLocation;
  reading: PeopleFlowReading;
};

export type GeoJsonFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    locationId: string;
    name: string;
    district: string;
    category?: string;
    congestionLevel?: string;
    congestionMessage?: string;
    populationMin?: number | null;
    populationMax?: number | null;
    lastUpdated?: string;
    traffic?: PeopleFlowTrafficStat;
    population?: PeopleFlowPopulationBreakdown;
    samples: PeopleFlowLiveSample[];
  };
};

export type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
  generatedAt: string;
  source: "seoul-open-data";
};

export type PeopleFlowConfig = {
  /**
   * Path to the JSON file that holds PeopleFlowLocation entries.
   */
  locationsPath: string;
  /**
   * Override API key if not provided via env var.
   */
  apiKey?: string;
  /**
   * Optional output path for writing GeoJSON snapshots via the CLI.
   */
  outputPath?: string;
  /**
   * Optional TTL in seconds for caching results on disk.
   */
  cacheTtlSeconds?: number;
};
