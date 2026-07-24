import { NextResponse } from "next/server";
import type { Entity } from "@/lib/types";

export const dynamic = "force-dynamic";

// Active conflict / crisis zones. Curated anchor set (stable, source-linked);
// each is a pulsing ring on the globe with an OSINT map deep-link.
const ZONES: { id: string; label: string; lat: number; lng: number; sev: string; note: string; src: string }[] = [
  { id: "ukraine", label: "Ukraine War", lat: 48.4, lng: 35.0, sev: "War", note: "Active frontlines across eastern & southern Ukraine.", src: "https://liveuamap.com/" },
  { id: "gaza", label: "Israel–Gaza", lat: 31.4, lng: 34.4, sev: "War", note: "Ongoing hostilities in Gaza and southern Israel.", src: "https://israelpalestine.liveuamap.com/" },
  { id: "lebanon", label: "Lebanon–Israel", lat: 33.3, lng: 35.4, sev: "Armed clashes", note: "Cross-border exchanges along the Blue Line.", src: "https://lebanon.liveuamap.com/" },
  { id: "sudan", label: "Sudan Civil War", lat: 15.5, lng: 32.5, sev: "War", note: "SAF vs RSF fighting; humanitarian crisis.", src: "https://sudan.liveuamap.com/" },
  { id: "myanmar", label: "Myanmar Civil War", lat: 21.9, lng: 96.1, sev: "War", note: "Junta vs resistance & ethnic armed groups.", src: "https://myanmar.liveuamap.com/" },
  { id: "syria", label: "Syria", lat: 35.0, lng: 38.5, sev: "Unrest", note: "Post-transition instability & localized clashes.", src: "https://syria.liveuamap.com/" },
  { id: "yemen", label: "Yemen", lat: 15.4, lng: 44.2, sev: "War", note: "Houthi control north; Red Sea shipping attacks.", src: "https://yemen.liveuamap.com/" },
  { id: "sahel", label: "Sahel Insurgency", lat: 14.5, lng: 0.5, sev: "Insurgency", note: "Jihadist insurgency across Mali, Niger, Burkina Faso.", src: "https://liveuamap.com/" },
  { id: "drc", label: "DR Congo (M23)", lat: -1.7, lng: 29.2, sev: "Armed conflict", note: "M23 offensive in North & South Kivu.", src: "https://liveuamap.com/" },
  { id: "sahel-lake", label: "Lake Chad Basin", lat: 12.9, lng: 13.8, sev: "Insurgency", note: "Boko Haram / ISWAP activity.", src: "https://liveuamap.com/" },
  { id: "somalia", label: "Somalia", lat: 2.0, lng: 45.3, sev: "Insurgency", note: "Al-Shabaab insurgency & AU operations.", src: "https://liveuamap.com/" },
  { id: "haiti", label: "Haiti Gang Crisis", lat: 18.55, lng: -72.33, sev: "Unrest", note: "Armed gang control of Port-au-Prince.", src: "https://liveuamap.com/" },
];

const SEV_COLOR: Record<string, string> = {
  War: "#ff4d4d",
  "Armed conflict": "#ff6a3d",
  "Armed clashes": "#ff6a3d",
  Insurgency: "#ff8c2a",
  Unrest: "#e0b020",
};

export async function GET() {
  const entities: Entity[] = ZONES.map((z) => ({
    uid: "conflicts:" + z.id,
    layer: "conflicts",
    id: z.id,
    label: z.label,
    lat: z.lat,
    lng: z.lng,
    altKm: 0,
    color: SEV_COLOR[z.sev] || "#ff4d4d",
    ring: true,
    props: {
      Zone: z.label,
      Severity: z.sev,
      Summary: z.note,
      "Live map": z.src,
    },
  }));
  return NextResponse.json({ ok: true, source: "OSINT (curated + liveuamap)", entities });
}
