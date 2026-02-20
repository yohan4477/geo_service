
import { execSync } from "child_process";

console.log("Starting real-time subway data update (every 30 seconds)...");

function update() {
  try {
    console.log(`[${new Date().toISOString()}] Updating transport data...`);
    execSync("node --import tsx scripts/generate-subway-geojson.ts", { stdio: "inherit" });
    execSync("node --import tsx scripts/generate-bus-geojson.ts", { stdio: "inherit" });
  } catch (e) {
    console.error("Update failed:", e);
  }
}

// Run immediately then every 30 seconds
update();
setInterval(update, 30000);
