import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";

export const dynamic = "force-dynamic";

// Best-effort IP geolocation of the caller → powers the opening fly-to-you
// animation. Behind Cloudflare the real client IP is in CF-Connecting-IP.
// ip-api.com is key-free (http only on the free tier, fine server-side).

function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    (h.get("x-forwarded-for") || "").split(",")[0].trim() ||
    ""
  );
}

async function locate(ip: string) {
  const q = ip ? encodeURIComponent(ip) : "";
  const r = await fetch(
    `http://ip-api.com/json/${q}?fields=status,lat,lon,city,regionName,country,countryCode`,
    { cache: "no-store", signal: AbortSignal.timeout(6000) }
  );
  const j = (await r.json()) as {
    status?: string; lat?: number; lon?: number;
    city?: string; regionName?: string; country?: string; countryCode?: string;
  };
  if (j.status !== "success" || typeof j.lat !== "number") throw new Error("geoip fail");
  return {
    lat: j.lat, lng: j.lon, city: j.city, region: j.regionName,
    country: j.country, countryCode: j.countryCode,
  };
}

export async function GET(req: Request) {
  const ip = clientIp(req);
  try {
    const geo = await cached("geoip:" + (ip || "self"), 3_600_000, () => locate(ip));
    return NextResponse.json({ ok: true, ...geo });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
