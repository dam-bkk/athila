import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import type { Entity } from "@/lib/types";

export const dynamic = "force-dynamic";

// Global disaster / crisis events from GDACS (Global Disaster Alert &
// Coordination System) — earthquakes, floods, cyclones, wildfires, droughts.
// Key-free GeoJSON. This is the same source osiris surfaces as its events feed.
const URL = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP";

type GProps = {
  eventtype?: string; eventname?: string; name?: string; description?: string;
  url?: string | { report?: string }; alertlevel?: string; country?: string;
  fromdate?: string; severitydata?: { severitytext?: string };
};
type GFeat = { geometry?: { coordinates?: [number, number] }; properties?: GProps };

const TYPE: Record<string, string> = {
  EQ: "Earthquake", TC: "Cyclone", FL: "Flood", VO: "Volcano", DR: "Drought", WF: "Wildfire",
};
const ALERT_COLOR: Record<string, string> = {
  Red: "#d500f9", Orange: "#b388ff", Green: "#9575ff",
};

function reportUrl(u: GProps["url"]): string {
  if (typeof u === "string") return u;
  return u?.report || "https://www.gdacs.org/";
}

// GDACS' WAF resets bare undici requests (ECONNRESET); a full browser-like
// header set is required for the TLS/handshake to be accepted.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
};

async function load(): Promise<Entity[]> {
  const r = await fetch(URL, {
    cache: "no-store",
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(12_000),
  });
  if (!r.ok) throw new Error("gdacs " + r.status);
  const j = (await r.json()) as { features?: GFeat[] };
  return (j.features || [])
    .map((f, i): Entity | null => {
      const c = f.geometry?.coordinates;
      const p = f.properties;
      if (!c || c.length < 2 || !p) return null;
      const kind = TYPE[p.eventtype || ""] || p.eventtype || "Event";
      const alert = p.alertlevel || "Green";
      return {
        uid: "gdelt:" + (p.eventtype || "") + i,
        layer: "gdelt",
        id: String(i),
        label: p.eventname || p.name || kind,
        lat: c[1],
        lng: c[0],
        altKm: 0,
        color: ALERT_COLOR[alert] || "#ffd23f",
        ring: alert === "Red" || alert === "Orange",
        props: {
          Event: kind,
          Name: p.eventname || p.name || "—",
          Alert: alert,
          Severity: p.severitydata?.severitytext || p.description || "—",
          Country: p.country || "—",
          Since: (p.fromdate || "").slice(0, 10) || "—",
          Report: reportUrl(p.url),
        },
      };
    })
    .filter((e): e is Entity => e !== null);
}

export async function GET() {
  try {
    const entities = await cached("gdelt", 300_000, load);
    return NextResponse.json({ ok: true, source: "GDACS", entities });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e), entities: [] });
  }
}
