import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";

export const dynamic = "force-dynamic";

// Certificate-transparency history via crt.sh — every SSL/TLS cert ever issued
// for a domain (and subdomains). Reveals subdomains + hosting history. Key-free.
type Crt = { issuer_name?: string; common_name?: string; name_value?: string; not_before?: string; not_after?: string };

async function load(domain: string) {
  const r = await fetch(`https://crt.sh/?q=${encodeURIComponent("%." + domain)}&output=json`, {
    cache: "no-store",
    headers: { "User-Agent": "ARGOS/1.0" },
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error("crtsh " + r.status);
  const rows = (await r.json()) as Crt[];
  const subdomains = new Set<string>();
  for (const row of rows.slice(0, 500)) {
    for (const n of (row.name_value || "").split("\n")) {
      const s = n.trim().toLowerCase();
      if (s && !s.startsWith("*") && s.endsWith(domain)) subdomains.add(s);
    }
  }
  const recent = rows.slice(0, 8).map((c) => ({
    issuer: (c.issuer_name || "").replace(/.*O=([^,]+).*/, "$1").slice(0, 40) || "—",
    name: c.common_name || "—",
    from: (c.not_before || "").slice(0, 10),
    to: (c.not_after || "").slice(0, 10),
  }));
  return { total: rows.length, subdomains: [...subdomains].sort().slice(0, 60), recent };
}

export async function GET(req: Request) {
  const domain = (new URL(req.url).searchParams.get("domain") || "").trim().toLowerCase();
  if (!/^[a-z0-9.-]{3,253}\.[a-z]{2,}$/.test(domain)) return NextResponse.json({ ok: false, error: "invalid domain" });
  try {
    const data = await cached("osint:ssl:" + domain, 3_600_000, () => load(domain));
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) });
  }
}
