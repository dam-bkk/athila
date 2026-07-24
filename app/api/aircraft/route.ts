import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import type { Entity } from "@/lib/types";

export const dynamic = "force-dynamic";

// Live ADS-B. OpenSky's anonymous /states/all is rate-limited (429) from
// datacenter IPs, so the primary source is adsb.lol (community, key-free),
// queried over a grid of busy air regions and de-duplicated by ICAO hex.

const GRID: [number, number][] = [
  [50, 8], [48, 2], [51, 0], [41, 12], [40, -3], [52, 13], [55, 37], [59, 18],
  [40, -74], [34, -118], [41, -88], [29, -95], [43, -79], [33, -84], [37, -122], [45, -75],
  [35, 139], [31, 121], [22, 114], [13, 100], [1, 104], [28, 77], [25, 55], [19, 72],
  [-33, 151], [-37, 145], [-23, -46], [-34, -58], [-34, 18], [-1, 37], [30, 31], [41, 29],
];

type Ac = {
  hex: string; flight?: string; r?: string; t?: string;
  lat: number; lon: number; alt_baro?: number | string; gs?: number; track?: number; baro_rate?: number;
};

async function fetchPoint(lat: number, lon: number): Promise<Ac[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(`https://api.adsb.lol/v2/point/${lat}/${lon}/250`, { cache: "no-store" });
      if (r.status === 429) { await new Promise((s) => setTimeout(s, 500)); continue; }
      if (!r.ok) return [];
      const j = (await r.json()) as { ac?: Ac[] };
      return j.ac || [];
    } catch { return []; }
  }
  return [];
}

async function fromAdsbLol(): Promise<Entity[]> {
  // Batched to respect adsb.lol's per-IP rate limit (parallel-all → mostly 429).
  const results: Ac[][] = [];
  const BATCH = 6;
  for (let i = 0; i < GRID.length; i += BATCH) {
    const chunk = GRID.slice(i, i + BATCH);
    results.push(...(await Promise.all(chunk.map(([lat, lon]) => fetchPoint(lat, lon)))));
    if (i + BATCH < GRID.length) await new Promise((s) => setTimeout(s, 250));
  }
  const seen = new Set<string>();
  const out: Entity[] = [];
  for (const ac of results) {
    for (const a of ac) {
      if (!a.hex || seen.has(a.hex) || typeof a.lat !== "number" || typeof a.lon !== "number") continue;
      seen.add(a.hex);
      const altFt = typeof a.alt_baro === "number" ? a.alt_baro : 0;
      const call = (a.flight || a.r || a.hex).trim();
      out.push({
        uid: "aircraft:" + a.hex,
        layer: "aircraft",
        id: a.hex,
        label: call,
        lat: a.lat,
        lng: a.lon,
        altKm: altFt * 0.0003048,
        color: "#ffb020",
        props: {
          Callsign: call,
          Registration: (a.r || "—").trim(),
          Type: a.t || "—",
          Altitude: Math.round(altFt) + " ft",
          Speed: Math.round((a.gs || 0) * 1.852) + " km/h",
          Heading: Math.round(a.track || 0) + "°",
          "Vertical rate": Math.round(a.baro_rate || 0) + " ft/min",
          "ICAO hex": a.hex,
        },
      });
    }
  }
  return out;
}

export async function GET() {
  try {
    const data = await cached("aircraft", 15_000, fromAdsbLol);
    return NextResponse.json({ ok: true, source: "adsb.lol", entities: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e), entities: [] });
  }
}
