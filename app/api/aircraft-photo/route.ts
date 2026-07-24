import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";

export const dynamic = "force-dynamic";

// Aircraft photo by ICAO 24-bit hex — planespotters.net public API (key-free,
// CC-licensed images with photographer credit).
type PP = {
  photos?: { thumbnail_large?: { src?: string }; thumbnail?: { src?: string }; photographer?: string; link?: string }[];
};

async function load(hex: string) {
  const r = await fetch(`https://api.planespotters.net/pub/photos/hex/${hex}`, {
    cache: "no-store",
    headers: { "User-Agent": "ARGOS/1.0 (contact: damien.asia)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error("pp " + r.status);
  const j = (await r.json()) as PP;
  const p = j.photos?.[0];
  const src = p?.thumbnail_large?.src || p?.thumbnail?.src;
  if (!src) return { ok: false };
  return { ok: true, photo: src, credit: p?.photographer || "planespotters.net", link: p?.link || "" };
}

export async function GET(req: Request) {
  const hex = (new URL(req.url).searchParams.get("hex") || "").toLowerCase().replace(/[^0-9a-f]/g, "");
  if (!hex) return NextResponse.json({ ok: false });
  try {
    const data = await cached("acphoto:" + hex, 86_400_000, () => load(hex));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ ok: false });
  }
}
