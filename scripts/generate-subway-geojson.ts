
import fs from "fs";
import path from "path";

const API_KEY = "747757744a6a6f683937694e636a52";

async function fetchStationMaster() {
  const url = `http://openapi.seoul.go.kr:8088/${API_KEY}/json/subwayStationMaster/1/1000/`;
  const response = await fetch(url);
  const data = await response.json();
  return data.subwayStationMaster.row;
}

async function fetchRealtimePositions(lineName: string) {
  const encodedLine = encodeURIComponent(lineName);
  const url = `http://swopenapi.seoul.go.kr/api/subway/${API_KEY}/json/realtimePosition/0/100/${encodedLine}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.realtimePositionList || [];
}

async function main() {
  console.log("Fetching station master data...");
  const stations = await fetchStationMaster();
  const stationMap = new Map();
  
  for (const s of stations) {
    // Some station names might have suffixes or slight differences
    const cleanName = s.BLDN_NM.split("(")[0].trim();
    stationMap.set(cleanName, {
      lat: parseFloat(s.LAT),
      lng: parseFloat(s.LOT)
    });
  }

  const lines = ["1호선", "2호선", "3호선", "4호선", "5호선", "6호선", "7호선", "8호선", "9호선"];
  const allFeatures = [];

  for (const line of lines) {
    console.log(`Fetching realtime positions for ${line}...`);
    try {
      const positions = await fetchRealtimePositions(line);
      for (const p of positions) {
        const stationName = p.statnNm;
        const coords = stationMap.get(stationName);
        
        if (coords) {
          allFeatures.push({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [coords.lng, coords.lat]
            },
            properties: {
              trainNo: p.trainNo,
              line: p.subwayNm,
              station: stationName,
              status: p.trainSttus === "0" ? "Entering" : p.trainSttus === "1" ? "Arriving" : "Departing",
              updnLine: p.updnLine === "0" ? "Up" : "Down"
            }
          });
        } else {
          // console.warn(`Coords not found for station: ${stationName}`);
        }
      }
    } catch (e) {
      console.error(`Failed to fetch ${line}:`, e);
    }
  }

  const geojson = {
    type: "FeatureCollection",
    features: allFeatures,
    generatedAt: new Date().toISOString()
  };

  const outputPath = path.join(process.cwd(), "ui", "public", "subway-latest.geojson");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));
  console.log(`GeoJSON generated at ${outputPath}`);
}

main();
