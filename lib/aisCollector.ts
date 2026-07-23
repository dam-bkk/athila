// Live vessel positions via AISStream (WebSocket). A single long-lived
// connection in the server process accumulates the latest position per MMSI
// into a bounded in-memory map; the /api/vessels route serves snapshots.
import WebSocket from "ws";

type Vessel = {
  mmsi: number; name: string;
  lat: number; lng: number;
  sog: number; cog: number; heading: number; status: number;
  lastSeen: number;
};

const MAX = 20000;
const store = new Map<number, Vessel>();
let ws: WebSocket | null = null;
let started = false;
let lastMsg = 0;

const STATUS: Record<number, string> = {
  0: "Under way (engine)", 1: "At anchor", 2: "Not under command",
  3: "Restricted manoeuvrability", 5: "Moored", 7: "Fishing", 8: "Under way (sailing)",
};

function prune() {
  const cutoff = Date.now() - 15 * 60_000;
  for (const [k, v] of store) if (v.lastSeen < cutoff) store.delete(k);
  if (store.size > MAX) {
    // drop the oldest-seen beyond the cap
    const sorted = [...store.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen);
    for (let i = 0; i < sorted.length - MAX; i++) store.delete(sorted[i][0]);
  }
}

function connect(key: string) {
  ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
  ws.on("open", () => {
    ws?.send(JSON.stringify({
      APIKey: key,
      BoundingBoxes: [[[-90, -180], [90, 180]]],
      FilterMessageTypes: ["PositionReport"],
    }));
  });
  ws.on("message", (raw: WebSocket.RawData) => {
    lastMsg = Date.now();
    try {
      const m = JSON.parse(raw.toString());
      if (m.MessageType !== "PositionReport") return;
      const md = m.MetaData || {};
      const pr = m.Message?.PositionReport || {};
      const mmsi = md.MMSI;
      const lat = md.latitude ?? pr.Latitude;
      const lng = md.longitude ?? pr.Longitude;
      if (typeof mmsi !== "number" || typeof lat !== "number" || typeof lng !== "number") return;
      store.set(mmsi, {
        mmsi, name: (md.ShipName || "").trim() || String(mmsi),
        lat, lng, sog: pr.Sog ?? 0, cog: pr.Cog ?? 0,
        heading: pr.TrueHeading ?? 511, status: pr.NavigationalStatus ?? -1,
        lastSeen: lastMsg,
      });
    } catch { /* ignore malformed */ }
  });
  const reconnect = () => {
    ws = null;
    setTimeout(() => connect(key), 4000);
  };
  ws.on("close", reconnect);
  ws.on("error", () => { try { ws?.close(); } catch { /* noop */ } });
}

export function startAis(key: string) {
  if (started) return;
  started = true;
  connect(key);
  setInterval(prune, 60_000);
}

export function vesselSnapshot(limit = 4000) {
  const arr = [...store.values()];
  // Prefer moving vessels, then most recently seen.
  arr.sort((a, b) => (b.sog - a.sog) || (b.lastSeen - a.lastSeen));
  return {
    count: store.size,
    fresh: Date.now() - lastMsg < 30_000,
    vessels: arr.slice(0, limit).map((v) => ({
      mmsi: v.mmsi, name: v.name, lat: v.lat, lng: v.lng,
      sog: v.sog, cog: v.cog, heading: v.heading,
      status: STATUS[v.status] || "—",
    })),
  };
}
