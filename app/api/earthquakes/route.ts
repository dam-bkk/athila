import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import type { Entity } from "@/lib/types";

export const dynamic = "force-dynamic";

type USGS = {
  features: {
    id: string;
    properties: { mag: number; place: string; time: number; url: string; tsunami: number };
    geometry: { coordinates: [number, number, number] };
  }[];
};

async function load(): Promise<Entity[]> {
  const r = await fetch(
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
    { cache: "no-store" }
  );
  if (!r.ok) throw new Error("usgs " + r.status);
  const j = (await r.json()) as USGS;
  return j.features.map((f) => {
    const [lng, lat, depth] = f.geometry.coordinates;
    const mag = f.properties.mag ?? 0;
    return {
      uid: "earthquakes:" + f.id,
      layer: "earthquakes" as const,
      id: f.id,
      label: "M" + mag.toFixed(1),
      lat,
      lng,
      altKm: 0,
      color: mag >= 5 ? "#ff2d55" : mag >= 3 ? "#ff5470" : "#ff8fa3",
      ring: true,
      ts: f.properties.time,
      props: {
        Magnitude: mag.toFixed(1),
        Place: f.properties.place || "—",
        Depth: Math.round(depth) + " km",
        Tsunami: f.properties.tsunami ? "ALERT" : "no",
        Time: new Date(f.properties.time).toLocaleString("en-GB"),
      },
    } satisfies Entity;
  });
}

export async function GET() {
  try {
    const data = await cached("quakes", 60_000, load);
    return NextResponse.json({ ok: true, source: "USGS", entities: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e), entities: [] });
  }
}
