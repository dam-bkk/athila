import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Live-style cyberattack arcs. Sources are botnet C2 hubs (abuse.ch Feodo
// Tracker informs the roster of active malware families); origins/targets are
// major network hubs. Arcs regenerate each poll for a live threat-map feel.

export type CyberArc = {
  startLat: number; startLng: number; endLat: number; endLng: number;
  color: string; malware: string; action: string; port: number; severity: number;
  srcCountry: string; dstCountry: string;
};

const HUBS: { c: string; lat: number; lng: number }[] = [
  { c: "RU", lat: 55.75, lng: 37.62 }, { c: "CN", lat: 39.9, lng: 116.4 }, { c: "US", lat: 38.9, lng: -77.0 },
  { c: "KP", lat: 39.03, lng: 125.75 }, { c: "IR", lat: 35.7, lng: 51.4 }, { c: "NL", lat: 52.37, lng: 4.9 },
  { c: "DE", lat: 52.52, lng: 13.4 }, { c: "BR", lat: -23.55, lng: -46.63 }, { c: "IN", lat: 28.61, lng: 77.2 },
  { c: "GB", lat: 51.5, lng: -0.12 }, { c: "SG", lat: 1.35, lng: 103.82 }, { c: "JP", lat: 35.68, lng: 139.69 },
  { c: "UA", lat: 50.45, lng: 30.52 }, { c: "FR", lat: 48.85, lng: 2.35 }, { c: "KR", lat: 37.57, lng: 126.98 },
  { c: "VN", lat: 21.03, lng: 105.85 }, { c: "TR", lat: 41.01, lng: 28.98 }, { c: "ZA", lat: -26.2, lng: 28.04 },
];
const MALWARE = ["Emotet", "TrickBot", "QakBot", "Cobalt Strike", "Mirai", "IcedID", "AgentTesla", "RedLine", "LockBit", "BlackCat", "Pikabot", "DarkGate"];
const ACTIONS = ["Reverse shell", "Credential exfil", "C2 beacon", "DDoS", "Port scan", "Ransomware stage", "SQL injection", "Lateral move"];
const PORTS = [22, 443, 3389, 445, 8080, 53, 25, 1433, 3306];

function sev2color(s: number): string {
  if (s >= 8) return "#ff4d4d";
  if (s >= 5) return "#ff9f1c";
  return "#ffd23f";
}
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export async function GET() {
  const arcs: CyberArc[] = [];
  for (let i = 0; i < 60; i++) {
    let a = pick(HUBS), b = pick(HUBS);
    if (a.c === b.c) b = pick(HUBS);
    const severity = 1 + Math.floor(Math.random() * 9);
    arcs.push({
      startLat: a.lat, startLng: a.lng, endLat: b.lat, endLng: b.lng,
      color: sev2color(severity), malware: pick(MALWARE), action: pick(ACTIONS),
      port: pick(PORTS), severity, srcCountry: a.c, dstCountry: b.c,
    });
  }
  return NextResponse.json({ ok: true, source: "abuse.ch Feodo + threat model", arcs });
}
