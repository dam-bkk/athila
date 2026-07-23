import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";

export const dynamic = "force-dynamic";

// Returns raw TLE sets grouped; the client propagates positions with
// satellite.js every frame (cheap, keeps orbits smooth without hammering us).
const GROUPS = ["stations", "visual", "starlink", "gps-ops", "galileo", "geo", "science", "weather"];

type Tle = { name: string; l1: string; l2: string; group: string };

async function load(): Promise<Tle[]> {
  const all: Tle[] = [];
  for (const g of GROUPS) {
    try {
      const r = await fetch(
        `https://celestrak.org/NORAD/elements/gp.php?GROUP=${g}&FORMAT=tle`,
        { cache: "no-store" } // our in-memory cache() handles TTL; some groups exceed Next's 2MB cache limit
      );
      if (!r.ok) continue;
      const text = await r.text();
      const lines = text.trim().split("\n");
      for (let i = 0; i + 2 < lines.length; i += 3) {
        all.push({
          name: lines[i].trim(),
          l1: lines[i + 1].trim(),
          l2: lines[i + 2].trim(),
          group: g,
        });
      }
    } catch {
      /* skip group */
    }
    if (all.length > 5000) break;
  }
  return all;
}

export async function GET() {
  try {
    const data = await cached("tle", 3_600_000, load);
    return NextResponse.json({ ok: true, source: "CelesTrak", tles: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e), tles: [] });
  }
}
