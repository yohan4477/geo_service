import type { GeoJsonFeatureCollection, PeopleFlowSnapshot } from "./types.js";

export function snapshotsToGeoJson(snapshots: PeopleFlowSnapshot[]): GeoJsonFeatureCollection {
  const features = snapshots.map((snapshot) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [snapshot.location.longitude, snapshot.location.latitude] as [number, number],
    },
    properties: {
      locationId: snapshot.location.id,
      name: snapshot.location.name,
      district: snapshot.location.district,
      category: snapshot.location.category,
      congestionLevel: snapshot.reading.congestionLevel,
      congestionMessage: snapshot.reading.congestionMessage,
      populationMin: snapshot.reading.populationMin,
      populationMax: snapshot.reading.populationMax,
      lastUpdated: snapshot.reading.lastUpdated,
      traffic: snapshot.reading.traffic,
      population: snapshot.reading.population,
      samples: snapshot.reading.samples,
    },
  }));
  return {
    type: "FeatureCollection",
    features,
    generatedAt: new Date().toISOString(),
    source: "seoul-open-data",
  };
}
