import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";

export const dynamic = "force-dynamic";

// WHOIS via RDAP (structured JSON, key-free) — registrar, dates, nameservers,
// status. rdap.org bootstraps to the authoritative registry.
type RdapEvent = { eventAction?: string; eventDate?: string };
type Rdap = {
  ldhName?: string; status?: string[];
  events?: RdapEvent[];
  entities?: { roles?: string[]; vcardArray?: unknown[] }[];
  nameservers?: { ldhName?: string }[];
};

function registrar(d: Rdap): string {
  const e = d.entities?.find((x) => x.roles?.includes("registrar"));
  const vcard = e?.vcardArray?.[1] as unknown[] | undefined;
  const fn = vcard?.find((r) => Array.isArray(r) && r[0] === "fn") as unknown[] | undefined;
  return (fn?.[3] as string) || "—";
}

async function load(domain: string) {
  const r = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
    cache: "no-store",
    headers: { Accept: "application/rdap+json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error("rdap " + r.status);
  const d = (await r.json()) as Rdap;
  const ev = (a: string) => d.events?.find((e) => e.eventAction === a)?.eventDate?.slice(0, 10) || "—";
  return {
    domain: d.ldhName || domain,
    registrar: registrar(d),
    created: ev("registration"),
    updated: ev("last changed"),
    expires: ev("expiration"),
    status: (d.status || []).join(", ") || "—",
    nameservers: (d.nameservers || []).map((n) => n.ldhName).filter(Boolean),
  };
}

export async function GET(req: Request) {
  const domain = (new URL(req.url).searchParams.get("domain") || "").trim().toLowerCase();
  if (!/^[a-z0-9.-]{3,253}\.[a-z]{2,}$/.test(domain)) return NextResponse.json({ ok: false, error: "invalid domain" });
  try {
    const data = await cached("osint:whois:" + domain, 3_600_000, () => load(domain));
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) });
  }
}
