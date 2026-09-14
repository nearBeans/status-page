"use strict";

const API_URL = "/api/status";
const REFRESH_INTERVAL_MS = 60_000;
const USE_MOCK_DATA = false;

const MOCK_STATUS = {
    overall: { status: "operational", message: "All Systems Operational.", message_ja: "すべてのシステムが正常動作中。" },
    server: {
        name: "ThinkCentre M75q tiny Gen2",
        status: "operational",
        metrics: { cpu: 23.4, memory: 58.2, disk: 71.3, temperature: 47 },
        specs: { hostname: "mofh-server", cpu: "AMD Ryzen 5 PRO 5650GE", gpu: "Radeon Graphics (Vega 7)", memory: "8 GB DDR4-3200", storage: "256 GB M.2 NVMe", os: "Ubuntu Server 26.04.1 LTS", architecture: "x86_64", kernel: "7.0.0-31-generic" },
        last_reboot: "2026-09-02T14:31:08+09:00"
    },
    services: [{ name: "Web Server", status: "operational" }, { name: "Docker", status: "operational" }, { name: "SSH", status: "operational" }],
    uptime: { percentage: 99.98, history: [{ status: "operational", start: "2026-09-13T16:00:00+09:00", end: "2026-09-13T17:00:00+09:00" }] },
    incidents: [],
    updated_at: "2026-09-14T17:30:00+09:00"
};

const STATUS_VALUES = new Set(["operational", "degraded", "outage", "unknown"]);
const INCIDENT_STATUS_VALUES = new Set([...STATUS_VALUES, "investigating", "resolved", "major-outage"]);
const STATUS_LABELS = {
    operational: "Operational",
    degraded: "Degraded",
    outage: "Outage",
    unknown: "Unknown",
    investigating: "Investigating",
    resolved: "Resolved",
    "major-outage": "Major outage"
};
const SPEC_LABELS = {
    hostname: "Hostname",
    cpu: "CPU",
    gpu: "GPU",
    memory: "Memory",
    storage: "Storage",
    os: "OS",
    architecture: "Architecture",
    kernel: "Kernel"
};

let refs;

function getRefs() {
    return {
        overallStatus: document.querySelector("#overall-status"),
        serverName: document.querySelector("#server-name"),
        serverStatus: document.querySelector("#server-status"),
        metrics: {
            cpu: document.querySelector('[data-field="cpu-usage"]'),
            memory: document.querySelector('[data-field="memory-usage"]'),
            disk: document.querySelector('[data-field="disk-usage"]'),
            temperature: document.querySelector('[data-field="temperature"]')
        },
        specsBody: document.querySelector("#server-specs-body"),
        specsTemplate: document.querySelector("#server-spec-row-template"),
        servicesList: document.querySelector("#services-list"),
        serviceTemplate: document.querySelector("#service-item-template"),
        uptimeChart: document.querySelector("#uptime-chart"),
        lastReboot: document.querySelector("#last-reboot"),
        incidentsSummary: document.querySelector("#incidents-summary"),
        incidentsList: document.querySelector("#incidents-list"),
        incidentTemplate: document.querySelector("#incident-item-template"),
        lastUpdated: document.querySelector("#last-updated")
    };
}

function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeStatus(value, allowedStatuses = STATUS_VALUES) {
    return typeof value === "string" && allowedStatuses.has(value) ? value : "unknown";
}

function statusLabel(status) {
    return STATUS_LABELS[status] ?? STATUS_LABELS.unknown;
}

function setText(element, value) {
    if (element) {
        element.textContent = value;
    }
}

function setStatus(element, status, text) {
    if (!element) {
        return;
    }

    element.dataset.status = status;
    element.textContent = text;
}

function formatMetric(value, unit) {
    const numericValue = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numericValue)) {
        return `--${unit}`;
    }

    return `${new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 }).format(numericValue)}${unit}`;
}

function formatTimestamp(value) {
    if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
        return null;
    }

    const parts = new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
    }).formatToParts(new Date(value));
    const part = (type) => parts.find((item) => item.type === type)?.value;

    return `${part("year")}/${part("month")}/${part("day")} ${part("hour")}:${part("minute")}:${part("second")} JST`;
}

function renderTime(element, value) {
    if (!element) {
        return;
    }

    const formatted = formatTimestamp(value);
    if (formatted) {
        element.dateTime = value;
        element.textContent = formatted;
    } else {
        element.removeAttribute("datetime");
        element.textContent = "--";
    }
}

function renderOverallStatus(overall) {
    const safeOverall = isRecord(overall) ? overall : {};
    const status = normalizeStatus(safeOverall.status);
    const messages = [safeOverall.message, safeOverall.message_ja]
        .filter((message) => typeof message === "string" && message.trim() !== "");

    setStatus(refs.overallStatus, status, messages.join(" ") || statusLabel(status));
}

function renderMetrics(metrics) {
    const safeMetrics = isRecord(metrics) ? metrics : {};
    setText(refs.metrics.cpu, formatMetric(safeMetrics.cpu, "%"));
    setText(refs.metrics.memory, formatMetric(safeMetrics.memory, "%"));
    setText(refs.metrics.disk, formatMetric(safeMetrics.disk, "%"));
    setText(refs.metrics.temperature, formatMetric(safeMetrics.temperature, "°C"));
}

function renderSpecs(specs) {
    if (!refs.specsBody || !refs.specsTemplate) {
        return;
    }

    const safeSpecs = isRecord(specs) ? specs : {};
    const rows = Object.entries(SPEC_LABELS)
        .filter(([key]) => safeSpecs[key] !== null && safeSpecs[key] !== undefined && String(safeSpecs[key]).trim() !== "")
        .map(([key, label]) => {
            const fragment = refs.specsTemplate.content.cloneNode(true);
            fragment.querySelector('[data-field="label"]').textContent = label;
            fragment.querySelector('[data-field="value"]').textContent = String(safeSpecs[key]);
            return fragment;
        });

    refs.specsBody.replaceChildren(...rows);
}

function renderServer(server) {
    const safeServer = isRecord(server) ? server : {};
    const status = normalizeStatus(safeServer.status);

    setText(refs.serverName, typeof safeServer.name === "string" ? safeServer.name : "");
    setStatus(refs.serverStatus, status, statusLabel(status));
    renderMetrics(safeServer.metrics);
    renderSpecs(safeServer.specs);
    renderTime(refs.lastReboot, safeServer.last_reboot);
}

function renderServices(services) {
    if (!refs.servicesList || !refs.serviceTemplate) {
        return;
    }

    const items = Array.isArray(services) ? services : [];
    const fragments = items.filter(isRecord).map((service) => {
        const fragment = refs.serviceTemplate.content.cloneNode(true);
        const status = normalizeStatus(service.status);
        fragment.querySelector('[data-field="name"]').textContent = typeof service.name === "string" ? service.name : "Unnamed service";
        const statusElement = fragment.querySelector('[data-field="status"]');
        statusElement.dataset.status = status;
        statusElement.textContent = statusLabel(status);
        return fragment;
    });

    refs.servicesList.replaceChildren(...fragments);
}

function renderUptime(uptime) {
    if (!refs.uptimeChart) {
        return;
    }

    const safeUptime = isRecord(uptime) ? uptime : {};
    const history = Array.isArray(safeUptime.history) ? safeUptime.history.filter(isRecord) : [];
    if (history.length === 0) {
        refs.uptimeChart.replaceChildren();
        refs.uptimeChart.textContent = "No uptime history available.";
        refs.uptimeChart.dataset.status = "unknown";
        refs.uptimeChart.setAttribute("aria-label", "No uptime history available");
        return;
    }

    const blocks = history.map((entry) => {
        const block = document.createElement("span");
        const status = normalizeStatus(entry.status);
        block.dataset.status = status;
        block.title = statusLabel(status);
        return block;
    });
    refs.uptimeChart.replaceChildren(...blocks);
    refs.uptimeChart.removeAttribute("data-status");
    refs.uptimeChart.setAttribute("aria-label", `Uptime history: ${history.length} interval${history.length === 1 ? "" : "s"}`);
}

function renderIncidents(incidents) {
    if (!refs.incidentsList || !refs.incidentTemplate) {
        return;
    }

    const items = Array.isArray(incidents) ? incidents.filter(isRecord) : [];
    setText(refs.incidentsSummary, items.length === 0 ? "No incidents reported." : `${items.length} incident${items.length === 1 ? "" : "s"} reported.`);
    refs.incidentsSummary.dataset.status = items.length === 0 ? "operational" : "unknown";

    const fragments = items.map((incident) => {
        const fragment = refs.incidentTemplate.content.cloneNode(true);
        const status = normalizeStatus(incident.status, INCIDENT_STATUS_VALUES);
        fragment.querySelector('[data-field="title"]').textContent = typeof incident.title === "string" ? incident.title : "Untitled incident";
        const statusElement = fragment.querySelector('[data-field="status"]');
        statusElement.dataset.status = status;
        statusElement.textContent = statusLabel(status);
        const timestampElement = fragment.querySelector('[data-field="timestamp"]');
        const timestamp = formatTimestamp(incident.timestamp);
        timestampElement.textContent = timestamp || "--";
        if (timestamp) {
            timestampElement.dateTime = incident.timestamp;
        }
        return fragment;
    });

    refs.incidentsList.replaceChildren(...fragments);
}

function renderLastUpdated(updatedAt) {
    renderTime(refs.lastUpdated, updatedAt);
}

function renderStatus(data) {
    const safeData = isRecord(data) ? data : {};
    renderOverallStatus(safeData.overall);
    renderServer(safeData.server);
    renderServices(safeData.services);
    renderUptime(safeData.uptime);
    renderIncidents(safeData.incidents);
    renderLastUpdated(safeData.updated_at);
}

function renderUnavailable() {
    setStatus(refs.overallStatus, "unknown", "Status unavailable.");
    setText(refs.serverName, "");
    setStatus(refs.serverStatus, "unknown", "Status unavailable.");
    renderMetrics({});
    renderSpecs({});
    renderServices([]);
    renderUptime({});
    setText(refs.incidentsSummary, "Incident status unavailable.");
    refs.incidentsSummary.dataset.status = "unknown";
    refs.incidentsList.replaceChildren();
    renderTime(refs.lastReboot, null);
    renderTime(refs.lastUpdated, null);
}

async function fetchStatus() {
    if (USE_MOCK_DATA) {
        return MOCK_STATUS;
    }

    const response = await fetch(API_URL, {
        headers: { Accept: "application/json" },
        cache: "no-store"
    });
    if (!response.ok) {
        throw new Error(`Status API returned ${response.status}`);
    }

    return response.json();
}

async function refreshStatus() {
    try {
        renderStatus(await fetchStatus());
    } catch (error) {
        console.error("Unable to refresh status:", error);
        renderUnavailable();
    }
}

function start() {
    refs = getRefs();
    refreshStatus();
    window.setInterval(() => {
        if (document.visibilityState === "visible") {
            refreshStatus();
        }
    }, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
            refreshStatus();
        }
    });
}

document.addEventListener("DOMContentLoaded", start);
