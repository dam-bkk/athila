import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import type { Entity } from "@/lib/types";

export const dynamic = "force-dynamic";

// Live ADS-B. OpenSky anonymous first; ADSB.fi military feed as fallback.
async function fromOpenSky(): Promise<Entity[]> {
  const r = await fetch("https://opensky-network.org/api/states/all", {
    cache: "no-store",
    headers: { "User-Agent": "substi-view/1.0" },
  });
  if (!r.ok) throw new Error("opensky " + r.status);
  const j = (await r.json()) as { states?: unknown[][] };
  return (j.states || [])
    .filter((s) => s[5] != null && s[6] != null)
    .map((s) => {
      const call = String(s[1] || "").trim() || String(s[0]);
      const alt = Number(s[7]) || 0;
      return {
        uid: "aircraft:" + s[0],
        layer: "aircraft" as const,
        id: String(s[0]),
        label: call,
        lat: Number(s[6]),
        lng: Number(s[5]),
        altKm: alt / 1000,
        color: "#ffb020",
        props: {
          Callsign: call,
          Country: String(s[2] || "—"),
          Altitude: Math.round(alt) + " m",
          Speed: Math.round((Number(s[9]) || 0) * 3.6) + " km/h",
          Heading: Math.round(Number(s[10]) || 0) + "°",
          "Vertical rate": Math.round(Number(s[11]) || 0) + " m/s",
          Transponder: String(s[0]),
        },
      } satisfies Entity;
    });
}

export async function GET() {
  try {
    const data = await cached("aircraft", 12_000, fromOpenSky);
    return NextResponse.json({ ok: true, source: "OpenSky", entities: data });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String(e), entities: [] },
      { status: 200 }
    );
  }
}
