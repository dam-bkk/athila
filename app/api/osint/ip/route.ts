import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";

export const dynamic = "force-dynamic";

// IP intelligence — geolocation, network owner, ASN, hosting/proxy flags.
// ip-api.com is key-free (http on the free tier, fine server-side).
async function load(ip: string) {
  const r = await fetch(
    `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,query,country,countryCode,regionName,city,lat,lon,timezone,isp,org,as,asname,reverse,mobile,proxy,hosting`,
    { cache: "no-store", signal: AbortSignal.timeout(8000) }
  );
  const j = await r.json();
  if (j.status !== "success") throw new Error(j.message || "lookup failed");
  return j;
}

export async function GET(req: Request) {
  const ip = (new URL(req.url).searchParams.get("ip") || "").trim();
  if (!/^[0-9a-fA-F:.]{3,}$/.test(ip)) return NextResponse.json({ ok: false, error: "invalid IP" });
  try {
    const data = await cached("osint:ip:" + ip, 3_600_000, () => load(ip));
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) });
  }
}
