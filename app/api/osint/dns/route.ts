import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";

export const dynamic = "force-dynamic";

// DNS records via Google DNS-over-HTTPS (key-free, TLS).
const TYPES = ["A", "AAAA", "MX", "NS", "TXT", "CNAME"] as const;

async function one(domain: string, type: string) {
  const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
  const j = (await r.json()) as { Answer?: { type: number; data: string }[] };
  return (j.Answer || []).map((a) => a.data);
}

async function load(domain: string) {
  const out: Record<string, string[]> = {};
  await Promise.all(
    TYPES.map(async (t) => {
      try { const v = await one(domain, t); if (v.length) out[t] = v; } catch { /* skip */ }
    })
  );
  return out;
}

export async function GET(req: Request) {
  const domain = (new URL(req.url).searchParams.get("domain") || "").trim().toLowerCase();
  if (!/^[a-z0-9.-]{3,253}\.[a-z]{2,}$/.test(domain)) return NextResponse.json({ ok: false, error: "invalid domain" });
  try {
    const records = await cached("osint:dns:" + domain, 600_000, () => load(domain));
    return NextResponse.json({ ok: true, records });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) });
  }
}
