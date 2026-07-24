// Live vessel positions via AISStream (WebSocket). A single long-lived
// connection in the server process accumulates the latest position per MMSI
// into a bounded in-memory map; the /api/vessels route serves snapshots.
import WebSocket from "ws";

type Vessel = {
  mmsi: number; name: string;
  lat: number; lng: number;
  sog: number; cog: number; heading: number; status: number;
  lastSeen: number;
  // voyage (from ShipStaticData)
  destination?: string; eta?: string; shipType?: string; callsign?: string; imo?: number;
};

// AIS ship-type code → human category.
function shipType(code: number): string {
  if (code >= 60 && code <= 69) return "Passenger";
  if (code >= 70 && code <= 79) return "Cargo";
  if (code >= 80 && code <= 89) return "Tanker";
  if (code >= 40 && code <= 49) return "High-speed craft";
  if (code === 30) return "Fishing";
  if (code === 31 || code === 32 || code === 52) return "Tug";
  if (code === 35) return "Military";
  if (code === 36) return "Sailing";
  if (code === 37) return "Pleasure craft";
  if (code === 51) return "Search & rescue";
  if (code === 55) return "Law enforcement";
  return code ? "Other (" + code + ")" : "—";
}

function etaStr(e: { Month?: number; Day?: number; Hour?: number; Minute?: number } | undefined): string {
  if (!e || !e.Month || !e.Day) return "—";
  const p = (n?: number) => String(n ?? 0).padStart(2, "0");
  return `${p(e.Month)}-${p(e.Day)} ${p(e.Hour)}:${p(e.Minute)} UTC`;
}

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
      FilterMessageTypes: ["PositionReport", "ShipStaticData"],
    }));
  });
  ws.on("message", (raw: WebSocket.RawData) => {
    lastMsg = Date.now();
    try {
      const m = JSON.parse(raw.toString());
      const md = m.MetaData || {};
      const mmsi = md.MMSI;
      if (typeof mmsi !== "number") return;

      // Voyage / static data — merge onto the existing record if present.
      if (m.MessageType === "ShipStaticData") {
        const sd = m.Message?.ShipStaticData || {};
        const cur = store.get(mmsi);
        const voyage = {
          destination: (sd.Destination || "").trim() || undefined,
          eta: etaStr(sd.Eta),
          shipType: shipType(sd.Type ?? 0),
          callsign: (sd.CallSign || "").trim() || undefined,
          imo: sd.ImoNumber || undefined,
        };
        if (cur) Object.assign(cur, voyage);
        else store.set(mmsi, { mmsi, name: (md.ShipName || "").trim() || String(mmsi), lat: 0, lng: 0, sog: 0, cog: 0, heading: 511, status: -1, lastSeen: lastMsg, ...voyage });
        return;
      }

      if (m.MessageType !== "PositionReport") return;
      const pr = m.Message?.PositionReport || {};
      const lat = md.latitude ?? pr.Latitude;
      const lng = md.longitude ?? pr.Longitude;
      if (typeof lat !== "number" || typeof lng !== "number") return;
      // AIS sentinels for "not available": SOG 102.3 (1023), COG 360, heading 511.
      const sog = typeof pr.Sog === "number" && pr.Sog < 102.3 ? pr.Sog : 0;
      const cog = typeof pr.Cog === "number" && pr.Cog < 360 ? pr.Cog : 0;
      const cur = store.get(mmsi);
      const base: Vessel = {
        mmsi, name: (md.ShipName || "").trim() || String(mmsi),
        lat, lng, sog, cog,
        heading: pr.TrueHeading ?? 511, status: pr.NavigationalStatus ?? -1,
        lastSeen: lastMsg,
      };
      // preserve voyage fields captured from ShipStaticData
      store.set(mmsi, cur ? { ...cur, ...base } : base);
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
      destination: v.destination || "", eta: v.eta || "", shipType: v.shipType || "",
      callsign: v.callsign || "", imo: v.imo || 0,
    })),
  };
}
