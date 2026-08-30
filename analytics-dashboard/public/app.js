const state = {
  days: 7,
  loading: false,
  refreshTimer: null,
};

const numberFormatter = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});
const exactNumberFormatter = new Intl.NumberFormat();
const percentFormatter = new Intl.NumberFormat(undefined, {
  style: "percent",
  maximumFractionDigits: 1,
});
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});
const regionNames =
  typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames([navigator.language], { type: "region" })
    : null;

const endpointLabels = {
  "/live-matches": "Live scores",
  "/league-standings": "League standings",
  "/match-detail": "Match details",
  "/tournament-bracket": "Tournament bracket",
  "/other": "Other / blocked",
};

const elements = {
  status: document.querySelector("#statusBanner"),
  refresh: document.querySelector("#refreshButton"),
  metricActiveClients: document.querySelector("#metricActiveClients"),
  metricRequests: document.querySelector("#metricRequests"),
  metricRequestRange: document.querySelector("#metricRequestRange"),
  metricFeatureRequests: document.querySelector("#metricFeatureRequests"),
  metricSuccessRate: document.querySelector("#metricSuccessRate"),
  metricLatency: document.querySelector("#metricLatency"),
  metricCacheHitRate: document.querySelector("#metricCacheHitRate"),
  requestTrend: document.querySelector("#requestTrend"),
  clientTrend: document.querySelector("#clientTrend"),
  endpointBars: document.querySelector("#endpointBars"),
  countryBars: document.querySelector("#countryBars"),
  versionBars: document.querySelector("#versionBars"),
  browserBars: document.querySelector("#browserBars"),
  leagueBars: document.querySelector("#leagueBars"),
  clientBars: document.querySelector("#clientBars"),
  endpointTable: document.querySelector("#endpointTable"),
  coverage: document.querySelector("#coverageText"),
  warnings: document.querySelector("#warningList"),
  freshness: document.querySelector("#freshnessText"),
};

document.querySelectorAll("[data-days]").forEach((button) => {
  button.addEventListener("click", () => {
    const days = Number.parseInt(button.dataset.days || "7", 10);
    if (days === state.days || state.loading) return;
    state.days = days;
    document.querySelectorAll("[data-days]").forEach((candidate) => {
      candidate.classList.toggle("is-active", candidate === button);
    });
    loadAnalytics(false);
  });
});

elements.refresh.addEventListener("click", () => loadAnalytics(true));
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) loadAnalytics(false);
});

loadAnalytics(false);
scheduleRefresh();

async function loadAnalytics(forceRefresh) {
  if (state.loading) return;
  state.loading = true;
  elements.refresh.disabled = true;
  setStatus("Loading current Cloudflare data…", "loading");

  try {
    const query = new URLSearchParams({ days: String(state.days) });
    if (forceRefresh) query.set("refresh", "1");
    const response = await fetch(`/api/analytics?${query}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    renderDashboard(payload);
    const warningCount = payload.warnings?.length || 0;
    setStatus(
      warningCount
        ? `Updated with ${warningCount} source warning${warningCount === 1 ? "" : "s"}. See Data coverage.`
        : "All available Cloudflare sources are current.",
      warningCount ? "warning" : "ready",
    );
  } catch (error) {
    setStatus(`Could not load analytics: ${error.message}`, "error");
  } finally {
    state.loading = false;
    elements.refresh.disabled = false;
  }
}

function renderDashboard(payload) {
  const summary = payload.summary || {};
  setText(elements.metricActiveClients, formatNumber(summary.latestEstimatedVisits));
  setText(elements.metricRequests, formatNumber(summary.requests));
  setText(elements.metricRequestRange, `Last ${payload.rangeDays || state.days} days`);
  setText(elements.metricFeatureRequests, formatNumber(summary.featureRequests));
  setText(elements.metricSuccessRate, formatPercent(summary.successRate));
  setText(elements.metricLatency, formatDuration(summary.avgDurationMs));
  setText(elements.metricCacheHitRate, formatPercent(summary.cacheHitRate));

  renderLineChart(elements.requestTrend, payload.daily || [], {
    valueKey: "requests",
    label: "requests",
  });
  renderLineChart(elements.clientTrend, payload.estimatedVisits || [], {
    valueKey: "estimatedVisits",
    label: "estimated visits",
  });

  renderBars(
    elements.endpointBars,
    (payload.endpoints || []).map((row) => ({
      label: endpointLabels[row.endpoint] || row.endpoint,
      value: row.requests,
    })),
  );
  renderBars(
    elements.countryBars,
    (payload.countries || []).map((row) => ({
      ...row,
      label: formatCountry(row.label),
    })),
  );
  renderBars(elements.versionBars, payload.versions || []);
  renderBars(elements.browserBars, payload.browsers || []);
  renderBars(elements.leagueBars, payload.leagues || []);
  renderBars(elements.clientBars, payload.clientTraffic || []);
  renderEndpointTable(payload.endpoints || []);
  renderCoverage(payload);

  const generatedAt = payload.generatedAt ? new Date(payload.generatedAt) : new Date();
  setText(
    elements.freshness,
    `Refreshed ${dateTimeFormatter.format(generatedAt)} · local cache ${payload.cache || "unknown"}`,
  );
}

function renderLineChart(container, rows, options) {
  container.replaceChildren();
  const validRows = rows
    .map((row) => ({
      day: String(row.day || ""),
      value: Number(row[options.valueKey]) || 0,
    }))
    .filter((row) => row.day);

  if (validRows.length < 2) {
    renderEmpty(
      container,
      validRows.length === 0
        ? "No data is available for this source and date range yet."
        : "A trend appears after at least two daily observations.",
    );
    return;
  }

  const width = 820;
  const height = 260;
  const margin = { top: 18, right: 30, bottom: 40, left: 54 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(...validRows.map((row) => row.value), 1);
  const svg = svgElement("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": `${options.label} by day`,
  });

  for (let index = 0; index <= 4; index += 1) {
    const y = margin.top + (plotHeight * index) / 4;
    svg.append(
      svgElement("line", {
        x1: margin.left,
        x2: width - margin.right,
        y1: y,
        y2: y,
        class: "chart-grid-line",
      }),
    );
    const value = maxValue * (1 - index / 4);
    const label = svgElement("text", {
      x: margin.left - 10,
      y: y + 4,
      "text-anchor": "end",
      class: "chart-axis-label",
    });
    label.textContent = numberFormatter.format(value);
    svg.append(label);
  }

  const points = validRows.map((row, index) => {
    const x =
      margin.left +
      (validRows.length === 1 ? plotWidth / 2 : (plotWidth * index) / (validRows.length - 1));
    const y = margin.top + plotHeight - (row.value / maxValue) * plotHeight;
    return { ...row, x, y };
  });
  svg.append(
    svgElement("polyline", {
      points: points.map((point) => `${point.x},${point.y}`).join(" "),
      class: "chart-line",
    }),
  );

  const labelEvery = Math.max(1, Math.ceil(validRows.length / 7));
  points.forEach((point, index) => {
    svg.append(
      svgElement("circle", {
        cx: point.x,
        cy: point.y,
        r: 4,
        class: "chart-point",
      }),
    );

    if (index % labelEvery === 0 || index === points.length - 1) {
      const label = svgElement("text", {
        x: point.x,
        y: height - 13,
        "text-anchor": "middle",
        class: "chart-axis-label",
      });
      label.textContent = formatDate(point.day);
      svg.append(label);
    }
  });

  const latest = points.at(-1);
  const latestLabel = svgElement("text", {
    x: Math.min(width - margin.right, latest.x + 8),
    y: Math.max(15, latest.y - 10),
    "text-anchor": latest.x > width - 120 ? "end" : "start",
    class: "chart-value-label",
  });
  latestLabel.textContent = exactNumberFormatter.format(latest.value);
  svg.append(latestLabel);
  container.append(svg);
}

function renderBars(container, rows) {
  container.replaceChildren();
  const cleanRows = rows
    .filter((row) => Number(row.value) > 0)
    .slice(0, 8);
  if (cleanRows.length === 0) {
    renderEmpty(container, "No observations are available yet.");
    return;
  }
  const maxValue = Math.max(...cleanRows.map((row) => Number(row.value) || 0), 1);

  cleanRows.forEach((row) => {
    const wrapper = element("div", "bar-row");
    const label = element("span", "bar-label", String(row.label || "unknown"));
    label.title = String(row.label || "unknown");
    const track = element("div", "bar-track");
    const fill = element("div", "bar-fill");
    fill.style.width = `${Math.max(1, (Number(row.value) / maxValue) * 100)}%`;
    track.append(fill);
    const value = element("span", "bar-value", formatNumber(row.value));
    value.title = exactNumberFormatter.format(Number(row.value) || 0);
    wrapper.append(label, track, value);
    container.append(wrapper);
  });
}

function renderEndpointTable(rows) {
  elements.endpointTable.replaceChildren();
  if (rows.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "No endpoint analytics are available yet.";
    row.append(cell);
    elements.endpointTable.append(row);
    return;
  }

  rows.forEach((item) => {
    const row = document.createElement("tr");
    const values = [
      endpointLabels[item.endpoint] || item.endpoint,
      exactNumberFormatter.format(item.requests || 0),
      formatPercent(item.successRate),
      exactNumberFormatter.format(item.failedRequests || 0),
      formatDuration(item.avgDurationMs),
    ];
    values.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    elements.endpointTable.append(row);
  });
}

function renderCoverage(payload) {
  const first = payload.coverage?.firstEvent;
  const last = payload.coverage?.lastEvent;
  const coverageText = first && last
    ? `Feature analytics coverage: ${dateTimeFormatter.format(new Date(first))} to ${dateTimeFormatter.format(new Date(last))}.`
    : "Feature analytics will begin after the instrumented Worker receives its first request.";
  setText(elements.coverage, coverageText);

  elements.warnings.replaceChildren();
  (payload.warnings || []).forEach((warning) => {
    elements.warnings.append(element("div", "warning-item", warning));
  });
}

function renderEmpty(container, message) {
  container.replaceChildren(element("div", "empty-state", message));
}

function scheduleRefresh() {
  clearInterval(state.refreshTimer);
  state.refreshTimer = setInterval(() => {
    if (!document.hidden) loadAnalytics(false);
  }, 5 * 60 * 1000);
}

function setStatus(message, stateName) {
  elements.status.textContent = message;
  elements.status.classList.toggle("is-error", stateName === "error");
  elements.status.classList.toggle("is-ready", stateName === "ready");
}

function formatCountry(code) {
  const normalized = String(code || "unknown").toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized) || !regionNames) return normalized;
  try {
    return `${regionNames.of(normalized)} · ${normalized}`;
  } catch {
    return normalized;
  }
}

function formatDate(value) {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date);
}

function formatNumber(value) {
  const number = Number(value) || 0;
  return numberFormatter.format(number);
}

function formatPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? percentFormatter.format(number) : "—";
}

function formatDuration(value) {
  const milliseconds = Number(value);
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return "—";
  if (milliseconds >= 1000) return `${(milliseconds / 1000).toFixed(1)} s`;
  return `${Math.round(milliseconds)} ms`;
}

function setText(target, value) {
  target.textContent = value;
}

function element(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svgElement(tagName, attributes) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
  return node;
}
