import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import type { Entity } from "@/lib/types";

export const dynamic = "force-dynamic";

type LL2 = {
  results: {
    id: string;
    name: string;
    net: string;
    status: { name: string };
    launch_service_provider?: { name: string };
    rocket?: { configuration?: { name: string } };
    mission?: { name: string; description: string };
    pad?: { name: string; latitude: string; longitude: string; location?: { name: string } };
  }[];
};

async function load(): Promise<Entity[]> {
  const r = await fetch(
    "https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=30&mode=detailed",
    { cache: "no-store" }
  );
  if (!r.ok) throw new Error("ll2 " + r.status);
  const j = (await r.json()) as LL2;
  return j.results
    .filter((l) => l.pad?.latitude && l.pad?.longitude)
    .map((l) => ({
      uid: "launches:" + l.id,
      layer: "launches" as const,
      id: l.id,
      label: l.name.split("|")[0].trim(),
      lat: Number(l.pad!.latitude),
      lng: Number(l.pad!.longitude),
      altKm: 0,
      color: "#4de0c8",
      ring: true,
      ts: new Date(l.net).getTime(),
      props: {
        Mission: l.mission?.name || l.name,
        Rocket: l.rocket?.configuration?.name || "—",
        Provider: l.launch_service_provider?.name || "—",
        Pad: l.pad?.name || "—",
        Site: l.pad?.location?.name || "—",
        Status: l.status?.name || "—",
        "Window (T-0)": new Date(l.net).toLocaleString("en-GB"),
      },
    })) satisfies Entity[];
}

export async function GET() {
  try {
    const data = await cached("launches", 600_000, load);
    return NextResponse.json({ ok: true, source: "Launch Library 2", entities: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e), entities: [] });
  }
}
