import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import type { Entity } from "@/lib/types";

export const dynamic = "force-dynamic";

// Smithsonian Global Volcanism Program — weekly reported activity (WFS GeoJSON).
async function load(): Promise<Entity[]> {
  const url =
    "https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes&outputFormat=application/json&count=1500";
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("gvp " + r.status);
  const j = (await r.json()) as {
    features: {
      properties: Record<string, unknown>;
      geometry: { coordinates: [number, number] };
    }[];
  };
  return j.features
    .filter((f) => f.geometry?.coordinates)
    .slice(0, 1500)
    .map((f, i) => {
      const p = f.properties;
      const [lng, lat] = f.geometry.coordinates;
      const name = String(p.Volcano_Name || p.volcano_name || "Volcan " + i);
      return {
        uid: "volcanoes:" + (p.Volcano_Number || i),
        layer: "volcanoes" as const,
        id: String(p.Volcano_Number || i),
        label: name,
        lat,
        lng,
        altKm: 0,
        color: "#ff6a00",
        props: {
          Volcan: name,
          Pays: String(p.Country || p.country || "—"),
          Type: String(p.Primary_Volcano_Type || p.primary_volcano_type || "—"),
          "Dernière éruption": String(p.Last_Eruption_Year || p.last_eruption_year || "—"),
          Région: String(p.Region || p.region || "—"),
        },
      } satisfies Entity;
    });
}

export async function GET() {
  try {
    const data = await cached("volcanoes", 86_400_000, load);
    return NextResponse.json({ ok: true, source: "Smithsonian GVP", entities: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e), entities: [] });
  }
}
