import { NextResponse } from "next/server";
import type { Entity } from "@/lib/types";

export const dynamic = "force-dynamic";

// 24/7 news livestreams, geolocated to broadcast HQ. Rendered as globe points;
// the dossier embeds the live player. YouTube channel live-embed is key-free.
const CH: { id: string; name: string; city: string; country: string; lat: number; lng: number; channel: string }[] = [
  { id: "aljazeera", name: "Al Jazeera English", city: "Doha", country: "QA", lat: 25.32, lng: 51.53, channel: "UCNye-wNBqNL5ZzHSJj3l8Bg" },
  { id: "skynews", name: "Sky News", city: "London", country: "GB", lat: 51.51, lng: -0.13, channel: "UCoMdktPbSTixAyNGwb-UYkQ" },
  { id: "dwnews", name: "DW News", city: "Berlin", country: "DE", lat: 52.52, lng: 13.40, channel: "UCknLrEdhRCp1aegoMqRaCZg" },
  { id: "france24", name: "FRANCE 24 English", city: "Paris", country: "FR", lat: 48.85, lng: 2.35, channel: "UCQfwfsi5VrQ8yKZ-UWmAEFg" },
  { id: "abcnews", name: "ABC News (US)", city: "New York", country: "US", lat: 40.76, lng: -73.98, channel: "UCBi2mrWuNuyYy4gbM6fU18Q" },
  { id: "aljazeera_ar", name: "Al Jazeera Arabic", city: "Doha", country: "QA", lat: 25.28, lng: 51.52, channel: "UCfiwzLy-8yKzIbsmZTzxDgw" },
  { id: "trtworld", name: "TRT World", city: "Istanbul", country: "TR", lat: 41.01, lng: 28.98, channel: "UC7fWeaHhqgM4Ry-RMpM2YYw" },
  { id: "gbnews", name: "GB News", city: "London", country: "GB", lat: 51.50, lng: -0.12, channel: "UCT8UD_Mp0Xie8Gz73Gw6IHw" },
];

export async function GET() {
  const entities: Entity[] = CH.map((c) => ({
    uid: "live-news:" + c.id,
    layer: "live-news",
    id: c.id,
    label: c.name,
    lat: c.lat,
    lng: c.lng,
    altKm: 0,
    color: "#ff7ac4",
    props: {
      Channel: c.name,
      Location: `${c.city}, ${c.country}`,
      "Live feed": `https://www.youtube.com/embed/live_stream?channel=${c.channel}&autoplay=0`,
    },
  }));
  return NextResponse.json({ ok: true, source: "YouTube Live (curated)", entities });
}
