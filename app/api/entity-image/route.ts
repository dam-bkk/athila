import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";

export const dynamic = "force-dynamic";

// A representative image for any selected entity. Aircraft → planespotters
// (the actual airframe by ICAO hex). Everything else → Wikipedia/Wikimedia
// thumbnail via search generator (key-free, CC images).

async function planespotters(hex: string) {
  const r = await fetch(`https://api.planespotters.net/pub/photos/hex/${hex}`, {
    cache: "no-store",
    headers: { "User-Agent": "ARGOS/1.0 (+https://argos.damien.asia)" },
    signal: AbortSignal.timeout(7000),
  });
  if (!r.ok) throw new Error("pp");
  const j = (await r.json()) as { photos?: { thumbnail_large?: { src?: string }; photographer?: string; link?: string }[] };
  const p = j.photos?.[0];
  const src = p?.thumbnail_large?.src;
  if (!src) throw new Error("no photo");
  return { ok: true, image: src, credit: p?.photographer || "planespotters.net", link: p?.link || "", source: "planespotters" };
}

async function wikipedia(q: string) {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=1&prop=pageimages|info&inprop=url&piprop=thumbnail&pithumbsize=480&format=json&gsrsearch=" +
    encodeURIComponent(q);
  const r = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "ARGOS/1.0 (+https://argos.damien.asia)" },
    signal: AbortSignal.timeout(7000),
  });
  if (!r.ok) throw new Error("wiki");
  const j = (await r.json()) as { query?: { pages?: Record<string, { title?: string; thumbnail?: { source?: string }; fullurl?: string }> } };
  const pages = j.query?.pages ? Object.values(j.query.pages) : [];
  const hit = pages.find((p) => p.thumbnail?.source);
  if (!hit?.thumbnail?.source) throw new Error("no image");
  return { ok: true, image: hit.thumbnail.source, credit: hit.title || "Wikipedia", link: hit.fullurl || "", source: "wikipedia" };
}

// per-layer query hint to avoid false matches
function wikiQuery(layer: string, label: string): string | null {
  const l = label.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  switch (layer) {
    case "infrastructure": return l + " nuclear power plant";
    case "satellites": return l + " satellite";
    case "volcanoes": return l + " volcano";
    case "conflicts": return l;
    case "vessels": return l + " ship";
    case "launches": return l + " rocket launch";
    case "webcams": case "gdelt": case "cyber-attacks": case "cables": return null; // no meaningful per-object image
    default: return l;
  }
}

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const layer = p.get("layer") || "";
  const label = (p.get("label") || "").trim();
  const id = (p.get("id") || "").toLowerCase().replace(/[^0-9a-f]/g, "");

  try {
    if (layer === "aircraft" && id) {
      try { return NextResponse.json(await cached("img:ac:" + id, 86_400_000, () => planespotters(id))); } catch { /* fall through to wiki */ }
    }
    const q = wikiQuery(layer, label);
    if (!q) return NextResponse.json({ ok: false });
    const data = await cached("img:wiki:" + q, 86_400_000, () => wikipedia(q));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ ok: false });
  }
}
