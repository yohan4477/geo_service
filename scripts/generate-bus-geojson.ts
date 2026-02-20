
import fs from "fs";
import path from "path";

const API_KEY = "747757744a6a6f683937694e636a52";

// 샘플로 추적할 주요 버스 노선 ID (서울 주요 노선)
const TARGET_BUS_ROUTES = [
    { id: "100100112", name: "140", type: "BLUE" },
    { id: "100100077", name: "470", type: "BLUE" },
    { id: "100100063", name: "360", type: "BLUE" },
    { id: "100100411", name: "9401", type: "RED" },
    { id: "100100001", name: "01", type: "YELLOW" }
];

async function fetchBusPositions(routeId: string) {
  // 서울시 버스 위치 API (조회 범위 1~100)
  const url = `http://openapi.seoul.go.kr:8088/${API_KEY}/json/getBusPosByRtid/1/100/${routeId}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.getBusPosByRtid?.row || [];
  } catch (e) {
    return [];
  }
}

async function main() {
  console.log("Fetching real-time bus positions...");
  const allFeatures = [];

  for (const route of TARGET_BUS_ROUTES) {
    console.log(`Tracking Bus ${route.name}...`);
    const positions = await fetchBusPositions(route.id);
    
    for (const p of positions) {
      allFeatures.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [parseFloat(p.tmX), parseFloat(p.tmY)]
        },
        properties: {
          busId: p.plainNo,
          routeName: route.name,
          routeType: route.type,
          status: p.stopFlag === "1" ? "At Stop" : "Running",
          lastUpdate: p.dataTm
        }
      });
    }
  }

  const geojson = {
    type: "FeatureCollection",
    features: allFeatures,
    generatedAt: new Date().toISOString()
  };

  const outputPath = path.join(process.cwd(), "ui", "public", "bus-latest.geojson");
  fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));
  console.log(`Bus GeoJSON generated at ${outputPath}`);
}

main();
