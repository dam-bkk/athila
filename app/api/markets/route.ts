import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";

export const dynamic = "force-dynamic";

// Bottom-ticker markets. Crypto is live (CoinGecko, key-free); defense/aero
// equities are a light curated snapshot (live quotes need a keyed provider).
async function load() {
  let crypto: Record<string, number> = {};
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd",
      { cache: "no-store", signal: AbortSignal.timeout(8000) }
    );
    const j = (await r.json()) as Record<string, { usd: number }>;
    crypto = {
      BTC: j.bitcoin?.usd ?? 0,
      ETH: j.ethereum?.usd ?? 0,
      SOL: j.solana?.usd ?? 0,
    };
  } catch { /* keep empty */ }
  return {
    crypto,
    defense: [
      { sym: "RTX", name: "RTX" }, { sym: "LMT", name: "Lockheed" },
      { sym: "NOC", name: "Northrop" }, { sym: "GD", name: "Gen. Dynamics" },
      { sym: "BA", name: "Boeing" }, { sym: "PLTR", name: "Palantir" },
    ],
  };
}

export async function GET() {
  const data = await cached("markets", 60_000, load);
  return NextResponse.json({ ok: true, ...data });
}
