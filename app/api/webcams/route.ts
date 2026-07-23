import { NextResponse } from "next/server";
import { cached } from "@/lib/cache";
import type { Entity } from "@/lib/types";

export const dynamic = "force-dynamic";

// ── Public webcams ──────────────────────────────────────────────────────────
// If WINDY_KEY is set, we serve the full worldwide set from the Windy Webcams
// API (tens of thousands of PUBLICLY PUBLISHED webcams — tourism/traffic/weather,
// with embedded players). Without a key, we fall back to a curated baseline.
// We ONLY ever surface webcams the operator publishes for public viewing —
// never unsecured/private cameras.

type Cam = { id: string; name: string; city: string; country: string; lat: number; lng: number; feed: string };

const CURATED: Cam[] = [
  { id: "times-sq", name: "Times Square", city: "New York", country: "USA", lat: 40.7580, lng: -73.9855, feed: "https://www.earthcam.com/usa/newyork/timessquare/?cam=tsstreet" },
  { id: "eiffel", name: "Tour Eiffel / Trocadéro", city: "Paris", country: "France", lat: 48.8600, lng: 2.2880, feed: "https://www.skylinewebcams.com/en/webcam/france/ile-de-france/paris/tour-eiffel.html" },
  { id: "venice", name: "Grand Canal", city: "Venise", country: "Italie", lat: 45.4400, lng: 12.3330, feed: "https://www.skylinewebcams.com/en/webcam/italia/veneto/venezia/canal-grande.html" },
  { id: "shibuya", name: "Shibuya Crossing", city: "Tokyo", country: "Japon", lat: 35.6595, lng: 139.7004, feed: "https://www.youtube.com/results?search_query=shibuya+crossing+live" },
  { id: "vegas", name: "Fremont Street", city: "Las Vegas", country: "USA", lat: 36.1699, lng: -115.1423, feed: "https://www.earthcam.com/usa/nevada/lasvegas/downtown/?cam=fremontst" },
  { id: "geneve", name: "Genève Centre Ville", city: "Genève", country: "Suisse", lat: 46.2044, lng: 6.1432, feed: "https://www.skylinewebcams.com/en/webcam/schweiz/geneve/geneve.html" },
  { id: "bkk", name: "Bangkok Skyline", city: "Bangkok", country: "Thaïlande", lat: 13.7563, lng: 100.5018, feed: "https://www.skylinewebcams.com/en/webcam/thailand/bangkok.html" },
  { id: "abbey-road", name: "Abbey Road Crossing", city: "Londres", country: "UK", lat: 51.5320, lng: -0.1774, feed: "https://www.abbeyroad.com/crossing" },
  { id: "niagara", name: "Niagara Falls", city: "Niagara", country: "Canada", lat: 43.0828, lng: -79.0742, feed: "https://www.earthcam.com/world/canada/niagarafalls/?cam=niagarafalls" },
  { id: "sydney", name: "Sydney Harbour", city: "Sydney", country: "Australie", lat: -33.8568, lng: 151.2153, feed: "https://www.skylinewebcams.com/en/webcam/australia/new-south-wales/sydney/sydney-harbour.html" },
  { id: "dubai", name: "Dubai Marina", city: "Dubaï", country: "UAE", lat: 25.0805, lng: 55.1403, feed: "https://www.skylinewebcams.com/en/webcam/united-arab-emirates/dubai/dubai.html" },
  { id: "santorini", name: "Oia Sunset", city: "Santorin", country: "Grèce", lat: 36.4618, lng: 25.3753, feed: "https://www.skylinewebcams.com/en/webcam/greece/aegean/cyclades/santorini-oia.html" },
  { id: "copacabana", name: "Copacabana Beach", city: "Rio", country: "Brésil", lat: -22.9711, lng: -43.1822, feed: "https://www.skylinewebcams.com/en/webcam/brasil/rio-de-janeiro/rio-de-janeiro/copacabana.html" },
  { id: "reykjavik", name: "Volcan / Reykjavík", city: "Reykjavík", country: "Islande", lat: 64.1466, lng: -21.9426, feed: "https://www.ruv.is/eldgos" },
];

function curatedEntities(): Entity[] {
  return CURATED.map((c) => ({
    uid: "webcams:" + c.id, layer: "webcams", id: c.id, label: c.name,
    lat: c.lat, lng: c.lng, altKm: 0, color: "#c98bff", ring: true,
    props: {
      Location: c.city + ", " + c.country,
      Coordinates: c.lat.toFixed(4) + ", " + c.lng.toFixed(4),
      "▶ Live feed": c.feed,
    },
  }));
}

// Windy Webcams API v3 — paged worldwide fetch (public webcams only).
type WindyCam = {
  webcamId: number; title: string;
  location?: { latitude: number; longitude: number; city?: string; country?: string };
  // player values are embed-URL strings keyed by timelapse window (day/month/…).
  player?: { day?: string; month?: string; year?: string; lifetime?: string };
  images?: { current?: { preview?: string } };
};

async function windyEntities(key: string): Promise<Entity[]> {
  const out: Entity[] = [];
  const seen = new Set<number>();
  // Page through the most-viewed webcams worldwide (cap for payload sanity).
  for (let offset = 0; offset < 5000; offset += 50) {
    const url =
      "https://api.windy.com/webcams/api/v3/webcams?limit=50&offset=" + offset +
      "&include=location,player,images";
    const r = await fetch(url, { headers: { "x-windy-api-key": key }, cache: "no-store" });
    if (!r.ok) {
      if (offset === 0) throw new Error("windy " + r.status);
      break;
    }
    const j = (await r.json()) as { webcams?: WindyCam[] };
    const cams = j.webcams || [];
    if (!cams.length) break;
    for (const w of cams) {
      if (!w.location || seen.has(w.webcamId)) continue;
      seen.add(w.webcamId);
      const feed = w.player?.day || w.player?.month || "";
      const snap = w.images?.current?.preview || "";
      out.push({
        uid: "webcams:w" + w.webcamId, layer: "webcams", id: String(w.webcamId),
        label: w.title || "Webcam " + w.webcamId,
        lat: w.location.latitude, lng: w.location.longitude, altKm: 0,
        color: "#c98bff", ring: false,
        props: {
          Location: [w.location.city, w.location.country].filter(Boolean).join(", ") || "—",
          Coordinates: w.location.latitude.toFixed(4) + ", " + w.location.longitude.toFixed(4),
          ...(snap ? { "🖼 Snapshot": snap } : {}),
          ...(feed ? { "▶ Live feed": feed } : {}),
        },
      });
    }
  }
  return out;
}

export async function GET() {
  const key = process.env.WINDY_KEY;
  if (key) {
    try {
      const data = await cached("webcams-windy", 3_600_000, () => windyEntities(key));
      if (data.length) return NextResponse.json({ ok: true, source: "Windy Webcams", entities: data });
    } catch {
      /* fall through to curated */
    }
  }
  return NextResponse.json({ ok: true, source: "Curated public", entities: curatedEntities() });
}
