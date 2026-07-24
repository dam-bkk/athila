import { NextResponse } from "next/server";
import { startAis, vesselSnapshot } from "@/lib/aisCollector";
import type { Entity } from "@/lib/types";

export const dynamic = "force-dynamic";

export function GET() {
  const key = process.env.AISSTREAM_KEY;
  if (!key) return NextResponse.json({ ok: false, error: "no key", entities: [] });
  startAis(key); // idempotent — opens the WS on first call

  const snap = vesselSnapshot(4000);
  const entities: Entity[] = snap.vessels.map((v) => ({
    uid: "vessels:" + v.mmsi,
    layer: "vessels",
    id: String(v.mmsi),
    label: v.name,
    lat: v.lat,
    lng: v.lng,
    altKm: 0,
    color: "#1de9b6",
    props: {
      Vessel: v.name,
      MMSI: String(v.mmsi),
      ...(v.shipType ? { Type: v.shipType } : {}),
      ...(v.callsign ? { Callsign: v.callsign } : {}),
      ...(v.imo ? { IMO: String(v.imo) } : {}),
      Speed: v.sog.toFixed(1) + " kn",
      Heading: Math.round(v.cog) + "°",
      Status: v.status,
      ...(v.destination ? { Destination: v.destination } : {}),
      ...(v.eta ? { ETA: v.eta } : {}),
      Position: v.lat.toFixed(4) + ", " + v.lng.toFixed(4),
      "Voyage track": `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${v.mmsi}`,
    },
  }));

  return NextResponse.json({
    ok: true,
    source: snap.fresh ? "AISStream (live)" : "AISStream (connexion…)",
    entities,
  });
}
