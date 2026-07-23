import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";

export const dynamic = "force-dynamic";

// City/place search → coordinates, via OpenStreetMap Nominatim (no key).
// Proxied server-side to set a proper User-Agent and cache (usage policy).
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ ok: true, places: [] });
  try {
    const places = await cached(`geo:${q.toLowerCase()}`, 3_600_000, async () => {
      const url =
        "https://nominatim.openstreetmap.org/search?format=json&limit=5&q=" + encodeURIComponent(q);
      const r = await fetch(url, {
        headers: { "User-Agent": "athila-geospatial-console/1.0 (contact: damien.asia)" },
        cache: "no-store",
      });
      if (!r.ok) throw new Error("nominatim " + r.status);
      const j = (await r.json()) as { display_name: string; lat: string; lon: string; type: string }[];
      return j.map((p) => ({
        name: p.display_name,
        lat: Number(p.lat),
        lng: Number(p.lon),
        type: p.type,
      }));
    });
    return NextResponse.json({ ok: true, places });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e), places: [] });
  }
}
