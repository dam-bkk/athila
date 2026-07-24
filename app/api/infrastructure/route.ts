import { NextResponse } from "next/server";
import type { Entity } from "@/lib/types";

export const dynamic = "force-dynamic";

// Strategic infrastructure — nuclear power stations (curated, IAEA/operator
// public data). Static anchor set; stable coordinates for situational overlay.
const NUC: { name: string; city: string; country: string; lat: number; lng: number; mw: number; reactors: number; status?: string }[] = [
  { name: "Zaporizhzhia NPP", city: "Enerhodar", country: "Ukraine", lat: 47.5113, lng: 34.5861, mw: 5700, reactors: 6, status: "Active conflict zone" },
  { name: "Kashiwazaki-Kariwa", city: "Niigata", country: "Japan", lat: 37.4289, lng: 138.5959, mw: 7965, reactors: 7 },
  { name: "Bruce NGS", city: "Ontario", country: "Canada", lat: 44.3253, lng: -81.5992, mw: 6550, reactors: 8 },
  { name: "Hanul NPP", city: "Uljin", country: "South Korea", lat: 37.0928, lng: 129.3833, mw: 6189, reactors: 6 },
  { name: "Hanbit NPP", city: "Yeonggwang", country: "South Korea", lat: 35.4156, lng: 126.4172, mw: 6164, reactors: 6 },
  { name: "Gravelines", city: "Gravelines", country: "France", lat: 51.0153, lng: 2.1361, mw: 5460, reactors: 6 },
  { name: "Paluel", city: "Paluel", country: "France", lat: 49.858, lng: 0.6356, mw: 5320, reactors: 4 },
  { name: "Cattenom", city: "Cattenom", country: "France", lat: 49.4158, lng: 6.2181, mw: 5200, reactors: 4 },
  { name: "Palo Verde", city: "Arizona", country: "USA", lat: 33.3881, lng: -112.8617, mw: 3937, reactors: 3 },
  { name: "Vogtle", city: "Georgia", country: "USA", lat: 33.1428, lng: -81.7619, mw: 4536, reactors: 4 },
  { name: "Taishan", city: "Guangdong", country: "China", lat: 21.9, lng: 112.9833, mw: 3500, reactors: 2 },
  { name: "Yangjiang", city: "Guangdong", country: "China", lat: 21.7053, lng: 112.2569, mw: 6516, reactors: 6 },
  { name: "Kudankulam", city: "Tamil Nadu", country: "India", lat: 8.1681, lng: 77.7119, mw: 2000, reactors: 2 },
  { name: "Barakah", city: "Abu Dhabi", country: "UAE", lat: 23.9694, lng: 52.2344, mw: 5380, reactors: 4 },
  { name: "Novovoronezh", city: "Voronezh", country: "Russia", lat: 51.275, lng: 39.2069, mw: 3800, reactors: 4 },
  { name: "Bushehr", city: "Bushehr", country: "Iran", lat: 28.8296, lng: 50.8867, mw: 915, reactors: 1 },
];

export async function GET() {
  const entities: Entity[] = NUC.map((n) => ({
      uid: "infrastructure:" + n.name,
      layer: "infrastructure",
      id: n.name,
      label: n.name,
      lat: n.lat,
      lng: n.lng,
      altKm: 0,
      color: "#7fd8c4",
      props: {
        Facility: n.name,
        Type: "Nuclear power station",
        Location: `${n.city}, ${n.country}`,
        Reactors: String(n.reactors),
        "Capacity (MW)": n.mw.toLocaleString("en"),
        ...(n.status ? { Status: n.status } : {}),
      },
    }));
  return NextResponse.json({ ok: true, source: "IAEA / operators (curated)", entities });
}
