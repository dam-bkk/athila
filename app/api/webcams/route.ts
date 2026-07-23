import { NextResponse } from "next/server";
import type { Entity } from "@/lib/types";

export const dynamic = "force-static";

// Curated PUBLIC webcams — official 24/7 livestreams the operators publish for
// public viewing. No key needed. Clicking one opens its live feed. (For a full
// wall of thousands of embedded cams, the Windy Webcams free API key unlocks
// that — this curated set is the key-free baseline.)
type Cam = { id: string; name: string; city: string; country: string; lat: number; lng: number; feed: string };

const CAMS: Cam[] = [
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

const ENTITIES: Entity[] = CAMS.map((c) => ({
  uid: "webcams:" + c.id,
  layer: "webcams",
  id: c.id,
  label: c.name,
  lat: c.lat,
  lng: c.lng,
  altKm: 0,
  color: "#c98bff",
  ring: true,
  props: {
    Location: c.city + ", " + c.country,
    Coordinates: c.lat.toFixed(4) + ", " + c.lng.toFixed(4),
    "▶ Live feed": c.feed,
  },
}));

export function GET() {
  return NextResponse.json({ ok: true, source: "Public webcams", entities: ENTITIES });
}
