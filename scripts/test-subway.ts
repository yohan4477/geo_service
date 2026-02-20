
async function fetchSubwayPositions() {
  const apiKey = "747757744a6a6f683937694e636a52";
  const line = encodeURIComponent("2호선");
  const url = `http://swopenapi.seoul.go.kr/api/subway/${apiKey}/json/realtimePosition/0/50/${line}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Error: ${response.status} ${response.statusText}`);
      return;
    }
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Fetch failed:", error);
  }
}

async function fetchStationMaster() {
  const apiKey = "747757744a6a6f683937694e636a52";
  const url = `http://openapi.seoul.go.kr:8088/${apiKey}/json/subwayStationMaster/1/10/`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log("Station Master Sample:");
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Station master fetch failed:", error);
  }
}

fetchSubwayPositions();
fetchStationMaster();
