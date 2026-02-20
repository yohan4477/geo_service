import http from "node:http";
import express from "express";
import type { TravelSignalConfig } from "./types.js";
import { TravelSignalService } from "./service.js";
import { normalizeJourneyStage, normalizePainpoint } from "./filters.js";

const DEFAULT_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

type DashboardServerOptions = {
  host?: string;
  port?: number;
  refreshIntervalMs?: number;
  autoIngest?: boolean;
  ingestOnStart?: boolean;
  config: TravelSignalConfig;
  logger?: Pick<Console, "log" | "error">;
};

type DashboardServer = {
  url: string;
  close: () => Promise<void>;
};

export async function startTravelSignalDashboardServer(
  options: DashboardServerOptions,
): Promise<DashboardServer> {
  const app = express();
  const service = await TravelSignalService.create({ config: options.config }, { logger: console });
  const refreshInterval =
    typeof options.refreshIntervalMs === "number" && options.refreshIntervalMs > 0
      ? options.refreshIntervalMs
      : DEFAULT_REFRESH_INTERVAL_MS;

  app.use(express.json());

  app.get("/api/insights", (req, res) => {
    const stage = normalizeJourneyStage(String(req.query.stage ?? "").trim() || undefined);
    const painpoint = normalizePainpoint(String(req.query.painpoint ?? "").trim() || undefined);
    const limitRaw = Number.parseInt(String(req.query.limit ?? ""), 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;
    const insights = service.listInsights({ stage, painpoint, limit });
    res.json({ insights });
  });

  app.get("/api/events", (_req, res) => {
    res.json({ events: service.listEvents() });
  });

  app.post("/api/ingest", async (_req, res) => {
    try {
      const insights = await service.ingest();
      res.json({ ok: true, generated: insights.length });
    } catch (error) {
      options.logger?.error?.("[travel-signal] Ingest error", error);
      res.status(500).json({ ok: false, error: (error as Error)?.message ?? "unknown error" });
    }
  });

  app.get("/", (_req, res) => {
    res.type("html").send(buildHtml());
  });

  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 4175;
  const server = await startListening(app, port, host);
  const startedAddress = server.address();
  const prettyAddress =
    typeof startedAddress === "object" && startedAddress
      ? `http://${startedAddress.address}:${startedAddress.port}`
      : `http://${host}:${port}`;
  options.logger?.log?.(`[travel-signal] dashboard listening on ${prettyAddress}`);

  let ingestTimer: NodeJS.Timeout | null = null;
  const runIngest = async () => {
    try {
      const generated = await service.ingest();
      options.logger?.log?.(
        `[travel-signal] ingest complete (${generated.length} new insight${generated.length === 1 ? "" : "s"})`,
      );
    } catch (error) {
      options.logger?.error?.("[travel-signal] ingest failed", error);
    }
  };

  if (options.autoIngest !== false) {
    ingestTimer = setInterval(() => {
      void runIngest();
    }, refreshInterval);
  }

  if (options.ingestOnStart !== false) {
    void runIngest();
  }

  async function closeServer() {
    if (ingestTimer) {
      clearInterval(ingestTimer);
      ingestTimer = null;
    }
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  const address = server.address();
  const url =
    typeof address === "object" && address ? `http://${address.address}:${address.port}` : prettyAddress;

  return {
    url,
    close: closeServer,
  };
}

function startListening(app: express.Express, port: number, host: string): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => resolve(server));
    server.on("error", (error) => reject(error));
  });
}

function buildHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Travel Signal Dashboard</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: "Pretendard", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      --accent: #3ec2c6;
      --bg: #0f172a;
      --card: rgba(15, 23, 42, 0.65);
      --border: rgba(148, 163, 184, 0.25);
      --muted: #94a3b8;
    }
    body {
      margin: 0;
      padding: 0;
      background: var(--bg);
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      padding: 1.5rem 2rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1rem;
    }
    header h1 {
      margin: 0;
      font-size: 1.5rem;
      letter-spacing: -0.02em;
    }
    main {
      flex: 1;
      padding: 1.5rem;
      display: grid;
      grid-template-columns: minmax(250px, 320px) 1fr;
      gap: 1.5rem;
    }
    .panel {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 1.25rem;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.35);
      backdrop-filter: blur(12px);
    }
    .panel h2 {
      margin: 0 0 1rem;
      font-size: 1rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-size: 0.85rem;
      color: var(--muted);
    }
    select {
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.65rem 0.85rem;
      color: #f8fafc;
      font-size: 0.95rem;
    }
    button {
      padding: 0.65rem 1rem;
      border: none;
      border-radius: 999px;
      background: linear-gradient(120deg, var(--accent), #8b5cf6);
      color: #0f172a;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s ease;
    }
    button.secondary {
      background: rgba(148, 163, 184, 0.2);
      color: #e2e8f0;
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .filters {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .cards {
      display: grid;
      gap: 1rem;
    }
    .insight {
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 18px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      position: relative;
      overflow: hidden;
    }
    .insight::after {
      content: "";
      position: absolute;
      inset: 0;
      border-radius: 18px;
      pointer-events: none;
      border: 1px solid transparent;
      background: linear-gradient(120deg, rgba(62, 194, 198, 0.2), rgba(139, 92, 246, 0.15));
      mask: linear-gradient(#fff, #fff) content-box, linear-gradient(#fff, #fff);
      mask-composite: exclude;
      padding: 1px;
    }
    .insight h3 {
      margin: 0;
      font-size: 1.1rem;
    }
    .insight .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      font-size: 0.8rem;
      color: var(--muted);
    }
    .chip {
      padding: 0.25rem 0.7rem;
      border-radius: 999px;
      background: rgba(62, 194, 198, 0.15);
      color: var(--accent);
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.07em;
    }
    .actions {
      margin-top: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-size: 0.9rem;
    }
    .status {
      margin-top: 1rem;
      font-size: 0.85rem;
      color: var(--muted);
    }
    @media (max-width: 900px) {
      main {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <header>
    <h1>Travel Signal Dashboard</h1>
    <span id="status" class="status">초기화 중...</span>
    <div style="margin-left:auto; display:flex; gap:0.5rem;">
      <button id="ingest">즉시 갱신</button>
      <button id="refresh" class="secondary">새로고침</button>
    </div>
  </header>
  <main>
    <section class="panel">
      <h2>Filters</h2>
      <div class="filters">
        <label>
          여정 단계
          <select id="stage">
            <option value="">전체</option>
            <option value="pre-trip">사전 준비</option>
            <option value="arrival">입국 직후</option>
            <option value="in-city">도시 체류</option>
            <option value="departure">귀국 전</option>
          </select>
        </label>
        <label>
          페인포인트
          <select id="painpoint">
            <option value="">전체</option>
            <option value="payment">결제</option>
            <option value="mobility">이동</option>
            <option value="information">정보</option>
            <option value="safety">안전</option>
            <option value="shopping">쇼핑</option>
            <option value="experience">체험</option>
          </select>
        </label>
      </div>
    </section>
    <section class="panel">
      <h2>Insights</h2>
      <div id="insights" class="cards"></div>
    </section>
  </main>
  <script type="module">
    const stageSelect = document.getElementById("stage");
    const painpointSelect = document.getElementById("painpoint");
    const insightsContainer = document.getElementById("insights");
    const statusEl = document.getElementById("status");
    const refreshBtn = document.getElementById("refresh");
    const ingestBtn = document.getElementById("ingest");

    async function fetchInsights() {
      try {
        refreshBtn.disabled = true;
        statusEl.textContent = "불러오는 중...";
        const params = new URLSearchParams();
        if (stageSelect.value) params.set("stage", stageSelect.value);
        if (painpointSelect.value) params.set("painpoint", painpointSelect.value);
        params.set("limit", "50");
        const res = await fetch(\`/api/insights?\${params.toString()}\`);
        const data = await res.json();
        renderInsights(data.insights ?? []);
        statusEl.textContent = \`\${new Date().toLocaleTimeString()} 기준\`;
      } catch (error) {
        console.error(error);
        statusEl.textContent = "데이터를 불러오지 못했습니다.";
      } finally {
        refreshBtn.disabled = false;
      }
    }

    function renderInsights(insights) {
      if (!insights.length) {
        insightsContainer.innerHTML = "<p style='color:var(--muted);'>표시할 인사이트가 없습니다.</p>";
        return;
      }
      insightsContainer.innerHTML = insights
        .map((insight) => {
          const actions = (insight.recommendedActions ?? [])
            .map((action) => \`<div>• \${action}</div>\`)
            .join("");
          return \`
            <article class="insight">
              <div class="meta">
                <span class="chip">\${insight.stage}</span>
                <span class="chip">\${insight.painpoint}</span>
                <span>Impact \${Math.round(insight.impactScore * 100)}%</span>
                <span>Conf. \${Math.round(insight.confidence * 100)}%</span>
              </div>
              <h3>\${insight.headline}</h3>
              <p>\${insight.details}</p>
              <div class="actions">\${actions}</div>
            </article>
          \`;
        })
        .join("");
    }

    async function triggerIngest() {
      ingestBtn.disabled = true;
      ingestBtn.textContent = "갱신 중...";
      try {
        const res = await fetch("/api/ingest", { method: "POST" });
        const data = await res.json();
        statusEl.textContent = \`새 인사이트 \${data.generated ?? 0}건\`;
        await fetchInsights();
      } catch (error) {
        console.error(error);
        statusEl.textContent = "즉시 갱신 실패";
      } finally {
        ingestBtn.disabled = false;
        ingestBtn.textContent = "즉시 갱신";
      }
    }

    stageSelect.addEventListener("change", fetchInsights);
    painpointSelect.addEventListener("change", fetchInsights);
    refreshBtn.addEventListener("click", fetchInsights);
    ingestBtn.addEventListener("click", triggerIngest);
    fetchInsights();
    setInterval(fetchInsights, 60_000);
  </script>
</body>
</html>`;
}
