import { NextResponse } from "next/server";
import type { Entity } from "@/lib/types";

export const dynamic = "force-static";

// "OPEN SECRETS" — sites the public believes are ultra-classified, but whose
// locations are fully public/OSINT (visible on Google Earth, in OSM, on
// Wikipedia, or in declassified reporting). Every entry pairs the MYTH with
// the public REALITY and cites where the coordinates come from.
type Secret = {
  id: string; name: string; lat: number; lng: number; cat: string;
  perceived: string; reality: string; source: string;
};

const SECRETS: Secret[] = [
  { id: "area51", name: "Area 51 (Groom Lake)", lat: 37.2350, lng: -115.8111, cat: "Test range",
    perceived: "Alien research, blacked out from all maps", reality: "USAF flight-test facility — fully visible on satellite imagery", source: "Google Earth / declassified CIA U-2 history (2013)" },
  { id: "nsa-utah", name: "NSA Utah Data Center", lat: 40.4306, lng: -111.9344, cat: "SIGINT",
    perceived: "Hidden mass-surveillance vault nobody can locate", reality: "Publicly sited data center — address, size and power draw are on record", source: "Public planning docs / Wikipedia" },
  { id: "pine-gap", name: "Pine Gap", lat: -23.7990, lng: 133.7370, cat: "SIGINT",
    perceived: "Secret US base Australia won't admit exists", reality: "Joint Defence Facility — named, mapped, radome field visible from the air", source: "OpenStreetMap / satellite imagery" },
  { id: "menwith", name: "RAF Menwith Hill", lat: 54.0086, lng: -1.6905, cat: "SIGINT",
    perceived: "Invisible ECHELON listening post", reality: "Golf-ball radomes plainly visible beside the A59 in Yorkshire", source: "Google Earth / public reporting" },
  { id: "cheyenne", name: "Cheyenne Mountain Complex", lat: 38.7443, lng: -104.8458, cat: "Command",
    perceived: "Impregnable secret NORAD bunker", reality: "Well-documented hardened command center; entrance & tunnel are public", source: "Wikipedia / NORAD public affairs" },
  { id: "raven-rock", name: "Raven Rock (Site R)", lat: 39.7340, lng: -77.4200, cat: "Continuity",
    perceived: "Mythical 'underground Pentagon'", reality: "Alternate Joint Communications Center — location & portals documented", source: "Declassified records / OSINT" },
  { id: "mount-weather", name: "Mount Weather", lat: 39.0625, lng: -77.8880, cat: "Continuity",
    perceived: "Secret government-survival city", reality: "FEMA continuity-of-government site, mapped and photographed", source: "Public FEMA docs / imagery" },
  { id: "haarp", name: "HAARP (Gakona)", lat: 62.3900, lng: -145.1500, cat: "Research",
    perceived: "Weather / mind-control weapon", reality: "Ionospheric research antenna array, now run by a university; open days held", source: "University of Alaska Fairbanks" },
  { id: "fe-warren", name: "F.E. Warren ICBM field (representative silo)", lat: 41.1500, lng: -104.8600, cat: "Missile",
    perceived: "Coordinates of nuclear silos are top secret", reality: "Minuteman III launch facilities are individually mapped in OSM & FOIA docs", source: "OpenStreetMap / FAS Nuclear Notebook" },
  { id: "vandenberg", name: "Vandenberg SFB", lat: 34.7420, lng: -120.5720, cat: "Missile / launch",
    perceived: "Secret missile base", reality: "Named Space Force launch range; schedules published in advance", source: "Public launch manifests" },
  { id: "plesetsk", name: "Plesetsk Cosmodrome", lat: 62.9250, lng: 40.5770, cat: "Missile / launch",
    perceived: "Hidden Soviet rocket site", reality: "Long-known cosmodrome; pads visible on any satellite map", source: "Satellite imagery / CelesTrak launch data" },
  { id: "baikonur", name: "Baikonur Cosmodrome", lat: 45.9650, lng: 63.3050, cat: "Launch",
    perceived: "Classified Russian spaceport", reality: "World's oldest operational spaceport — tours run there", source: "Roscosmos public" },
  { id: "yamantau", name: "Mount Yamantau", lat: 54.2700, lng: 58.1000, cat: "Underground",
    perceived: "Secret Russian doomsday mountain", reality: "Location & rail spurs are public; purpose debated but the site is mapped", source: "Satellite imagery / OSINT" },
  { id: "thule", name: "Pituffik Space Base (Thule)", lat: 76.5310, lng: -68.7030, cat: "Radar",
    perceived: "Secret Arctic nuclear base", reality: "BMEWS early-warning radar site, named and mapped", source: "US Space Force public" },
  { id: "fylingdales", name: "RAF Fylingdales", lat: 54.3617, lng: -0.6706, cat: "Radar",
    perceived: "Mysterious missile-tracking pyramid", reality: "Solid-state phased-array radar, clearly visible on the moors", source: "Google Earth / MoD public" },
  { id: "bude", name: "GCHQ Bude", lat: 50.8300, lng: -4.5500, cat: "SIGINT",
    perceived: "Secret cable-tapping station", reality: "Satellite ground station on the Cornish coast; role reported post-2013", source: "Public reporting / imagery" },
  { id: "offutt", name: "Offutt AFB (E-4B 'Doomsday plane' base)", lat: 41.1180, lng: -95.9120, cat: "Command",
    perceived: "Secret apocalypse-aircraft hangar", reality: "Home of US Strategic Command; the E-4B is frequently tracked on ADS-B", source: "OSINT / public flight tracking" },
  { id: "diego-garcia", name: "Diego Garcia", lat: -7.3130, lng: 72.4110, cat: "Base",
    perceived: "Off-the-map black site atoll", reality: "Major joint military base — runway, harbor & ships all visible", source: "Satellite imagery" },
  { id: "kola", name: "Kola Superdeep Borehole", lat: 69.3960, lng: 30.6090, cat: "Science",
    perceived: "Sealed 'gateway to hell'", reality: "Deepest man-made hole; a rusted, welded cap you can walk up to", source: "Public / Wikipedia" },
  { id: "seed-vault", name: "Svalbard Global Seed Vault", lat: 78.2385, lng: 15.4910, cat: "Continuity",
    perceived: "Secret 'doomsday' bunker", reality: "Crop-diversity backup vault — entrance is a known landmark", source: "Crop Trust public" },
];

const ENTITIES: Entity[] = SECRETS.map((s) => ({
  uid: "open-secrets:" + s.id,
  layer: "open-secrets",
  id: s.id,
  label: s.name,
  lat: s.lat,
  lng: s.lng,
  altKm: 0,
  color: "#ff4da6",
  ring: true,
  props: {
    Category: s.cat,
    "Perceived as": s.perceived,
    "Public reality": s.reality,
    Source: s.source,
    Coordinates: s.lat.toFixed(4) + ", " + s.lng.toFixed(4),
  },
}));

export function GET() {
  return NextResponse.json({ ok: true, source: "OSINT / public record", entities: ENTITIES });
}
