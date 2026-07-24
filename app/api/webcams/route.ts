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
  { id: "big-ben", name: "Big Ben / Westminster", city: "Londres", country: "UK", lat: 51.5007, lng: -0.1246, feed: "https://www.skylinewebcams.com/en/webcam/united-kingdom/england/london/london.html" },
  { id: "colosseo", name: "Colisée", city: "Rome", country: "Italie", lat: 41.8902, lng: 12.4922, feed: "https://www.skylinewebcams.com/en/webcam/italia/lazio/roma/roma-colosseo.html" },
  { id: "barcelona", name: "Sagrada Família", city: "Barcelone", country: "Espagne", lat: 41.4036, lng: 2.1744, feed: "https://www.skylinewebcams.com/en/webcam/espana/cataluna/barcelona/barcelona.html" },
  { id: "amsterdam", name: "Amsterdam Centre", city: "Amsterdam", country: "Pays-Bas", lat: 52.3676, lng: 4.9041, feed: "https://www.skylinewebcams.com/en/webcam/nederland/noord-holland/amsterdam/amsterdam.html" },
  { id: "hollywood", name: "Hollywood Sign", city: "Los Angeles", country: "USA", lat: 34.1341, lng: -118.3215, feed: "https://www.earthcam.com/usa/california/hollywood/?cam=hollywoodsign" },
  { id: "miami-beach", name: "Miami Beach", city: "Miami", country: "USA", lat: 25.7907, lng: -80.1300, feed: "https://www.earthcam.com/usa/florida/miamibeach/?cam=miamibeach" },
  { id: "sf-bridge", name: "Golden Gate Bridge", city: "San Francisco", country: "USA", lat: 37.8199, lng: -122.4783, feed: "https://www.earthcam.com/usa/california/sanfrancisco/goldengate/?cam=ggbridge" },
  { id: "singapore-mbs", name: "Marina Bay Sands", city: "Singapour", country: "Singapour", lat: 1.2834, lng: 103.8607, feed: "https://www.skylinewebcams.com/en/webcam/singapore/singapore/singapore.html" },
  { id: "hongkong", name: "Victoria Harbour", city: "Hong Kong", country: "Chine", lat: 22.2793, lng: 114.1628, feed: "https://www.skylinewebcams.com/en/webcam/china/hong-kong/hong-kong.html" },
  { id: "capetown", name: "Table Mountain", city: "Le Cap", country: "Afrique du Sud", lat: -33.9628, lng: 18.4098, feed: "https://www.skylinewebcams.com/en/webcam/south-africa/western-cape/cape-town/cape-town.html" },
  { id: "kruger", name: "Africam — Kruger", city: "Kruger", country: "Afrique du Sud", lat: -24.9964, lng: 31.5547, feed: "https://www.africam.com/" },
  { id: "moscow-red", name: "Place Rouge", city: "Moscou", country: "Russie", lat: 55.7539, lng: 37.6208, feed: "https://www.skylinewebcams.com/en/webcam/russia/moscow-city/moscow/red-square.html" },
  { id: "istanbul", name: "Bosphore", city: "Istanbul", country: "Turquie", lat: 41.0082, lng: 28.9784, feed: "https://www.skylinewebcams.com/en/webcam/turkiye/istanbul/istanbul/istanbul.html" },
  { id: "hawaii-volcano", name: "Kīlauea (USGS)", city: "Hawaï", country: "USA", lat: 19.4069, lng: -155.2834, feed: "https://www.usgs.gov/volcanoes/kilauea/webcams" },
  { id: "jackson-hole", name: "Town Square", city: "Jackson Hole", country: "USA", lat: 43.4799, lng: -110.7624, feed: "https://www.seejh.com/live" },
  { id: "venice-rialto", name: "Pont du Rialto", city: "Venise", country: "Italie", lat: 45.4380, lng: 12.3358, feed: "https://www.skylinewebcams.com/en/webcam/italia/veneto/venezia/rialto.html" },
];

function curatedEntities(): Entity[] {
  return CURATED.map((c) => ({
    uid: "webcams:" + c.id, layer: "webcams", id: c.id, label: c.name,
    lat: c.lat, lng: c.lng, altKm: 0, color: "#39ff14", ring: true,
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

function toEntity(w: WindyCam): Entity | null {
  if (!w.location) return null;
  const feed = w.player?.day || w.player?.month || "";
  const snap = w.images?.current?.preview || "";
  return {
    uid: "webcams:w" + w.webcamId, layer: "webcams", id: String(w.webcamId),
    label: w.title || "Webcam " + w.webcamId,
    lat: w.location.latitude, lng: w.location.longitude, altKm: 0,
    color: "#39ff14", ring: false,
    props: {
      Location: [w.location.city, w.location.country].filter(Boolean).join(", ") || "—",
      Coordinates: w.location.latitude.toFixed(4) + ", " + w.location.longitude.toFixed(4),
      ...(snap ? { "🖼 Snapshot": snap } : {}),
      ...(feed ? { "▶ Live feed": feed } : {}),
    },
  };
}

async function windyPaged(key: string, base: string, maxOffset: number): Promise<Entity[]> {
  const out: Entity[] = [];
  const seen = new Set<number>();
  for (let offset = 0; offset <= maxOffset; offset += 50) {
    const r = await fetch(`${base}&limit=50&offset=${offset}&include=location,player,images`, {
      headers: { "x-windy-api-key": key }, cache: "no-store",
    });
    if (!r.ok) break;
    const j = (await r.json()) as { webcams?: WindyCam[] };
    if (!j.webcams?.length) break;
    for (const w of j.webcams) {
      if (seen.has(w.webcamId)) continue;
      seen.add(w.webcamId);
      const e = toEntity(w);
      if (e) out.push(e);
    }
  }
  return out;
}

export async function GET(req: Request) {
  const key = process.env.WINDY_KEY;
  const near = new URL(req.url).searchParams.get("near"); // "lat,lng"

  if (key && near && /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(near)) {
    // On-demand: public webcams around a flown-to city (radius ~200 km).
    try {
      const data = await cached("webcams-near:" + near, 1_800_000, () =>
        windyPaged(key, `https://api.windy.com/webcams/api/v3/webcams?nearby=${near},200`, 200)
      );
      return NextResponse.json({ ok: true, source: "Windy (local)", entities: data });
    } catch {
      return NextResponse.json({ ok: true, source: "Windy (local)", entities: [] });
    }
  }

  if (key) {
    try {
      const data = await cached("webcams-windy", 3_600_000, () =>
        windyPaged(key, "https://api.windy.com/webcams/api/v3/webcams?", 1000)
      );
      // Always merge the curated notable set on top of the Windy results.
      const merged = [...curatedEntities(), ...data];
      if (merged.length) return NextResponse.json({ ok: true, source: "Windy + curated", entities: merged });
    } catch {
      /* fall through to curated */
    }
  }
  return NextResponse.json({ ok: true, source: "Curated public", entities: curatedEntities() });
}
