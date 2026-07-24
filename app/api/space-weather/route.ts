import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";

export const dynamic = "force-dynamic";

// NOAA SWPC planetary K-index → the "SOLAR: KpN" HUD indicator. Key-free.
async function load() {
  const r = await fetch(
    "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json",
    { cache: "no-store", signal: AbortSignal.timeout(8000) }
  );
  const rows = (await r.json()) as [string, string, string, string][];
  // Row 0 is a header; find the last row whose Kp parses to a finite number.
  let last: [string, string, string, string] | undefined;
  for (let i = rows.length - 1; i > 0; i--) {
    if (Number.isFinite(parseFloat(rows[i]?.[1]))) { last = rows[i]; break; }
  }
  const kp = last ? Math.round(parseFloat(last[1])) : 0;
  const level =
    kp >= 7 ? "Severe storm" : kp >= 5 ? "Geomagnetic storm" : kp >= 4 ? "Unsettled" : "Quiet";
  const color = kp >= 5 ? "#ff3d3d" : kp >= 4 ? "#ff9500" : "#00e676";
  return { kp, level, color, time: last?.[0] ?? null };
}

export async function GET() {
  try {
    const data = await cached("space-weather", 600_000, load);
    return NextResponse.json({ ok: true, ...data });
  } catch {
    return NextResponse.json({ ok: false, kp: 0, level: "—", color: "#00e676" });
  }
}
