import { NextResponse } from "next/server";
import type { Entity } from "@/lib/types";

export const dynamic = "force-dynamic";

// Wildlife tracking. Live per-animal telemetry (Movebank/OCEARCH) requires
// credentials, so this is a curated set of notable satellite-tagged animals
// with links to their public tracking programmes.
const A: { id: string; name: string; species: string; group: string; lat: number; lng: number; prog: string; link: string }[] = [
  { id: "shark-katharine", name: "Katharine", species: "White shark", group: "shark", lat: 32.1, lng: -78.4, prog: "OCEARCH", link: "https://www.ocearch.org/tracker/" },
  { id: "shark-mary-lee", name: "Mary Lee", species: "White shark", group: "shark", lat: 39.8, lng: -72.1, prog: "OCEARCH", link: "https://www.ocearch.org/tracker/" },
  { id: "shark-nukumi", name: "Nukumi", species: "White shark", group: "shark", lat: 44.2, lng: -63.0, prog: "OCEARCH", link: "https://www.ocearch.org/tracker/" },
  { id: "shark-brunswick", name: "Brunswick", species: "Tiger shark", group: "shark", lat: 25.9, lng: -79.8, prog: "OCEARCH", link: "https://www.ocearch.org/tracker/" },
  { id: "whale-blue-pac", name: "Blue whale (Pacific)", species: "Blue whale", group: "whale", lat: 33.6, lng: -119.5, prog: "Whale mCDR / ARGOS", link: "https://whalesafe.com/" },
  { id: "whale-humpback-sa", name: "Humpback (S. Atlantic)", species: "Humpback whale", group: "whale", lat: -25.2, lng: 13.1, prog: "Happywhale", link: "https://happywhale.com/" },
  { id: "whale-narwhal", name: "Narwhal", species: "Narwhal", group: "whale", lat: 71.9, lng: -55.4, prog: "Arctic tagging", link: "https://www.movebank.org/" },
  { id: "elephant-tim", name: "Tim", species: "African elephant", group: "elephant", lat: -2.7, lng: 37.3, prog: "Save the Elephants", link: "https://www.savetheelephants.org/" },
  { id: "elephant-amara", name: "Amara (herd)", species: "African elephant", group: "elephant", lat: -19.0, lng: 23.4, prog: "Elephants Without Borders", link: "https://elephantswithoutborders.org/" },
  { id: "rhino-black-kenya", name: "Black rhino", species: "Black rhino", group: "rhino", lat: -0.5, lng: 37.5, prog: "Ol Pejeta / WWF", link: "https://www.olpejetaconservancy.org/" },
  { id: "rhino-white-sa", name: "White rhino", species: "Southern white rhino", group: "rhino", lat: -24.9, lng: 31.6, prog: "Kruger anti-poaching", link: "https://www.sanparks.org/" },
  { id: "tiger-bengal", name: "Bengal tiger", species: "Bengal tiger", group: "tiger", lat: 27.5, lng: 84.3, prog: "WWF Nepal", link: "https://www.worldwildlife.org/" },
  { id: "polar-bear-1", name: "Polar bear", species: "Polar bear", group: "bear", lat: 74.5, lng: -95.0, prog: "Polar Bears Int'l", link: "https://polarbearsinternational.org/" },
  { id: "seaturtle-1", name: "Leatherback turtle", species: "Leatherback sea turtle", group: "turtle", lat: 8.9, lng: -83.6, prog: "Sea Turtle Conservancy", link: "https://conserveturtles.org/" },
  { id: "albatross-1", name: "Wandering albatross", species: "Wandering albatross", group: "bird", lat: -46.4, lng: 51.8, prog: "BirdLife tracking", link: "https://www.birdlife.org/" },
];

const COLOR: Record<string, string> = {
  shark: "#4aa3ff", whale: "#7fd8c4", elephant: "#c9a227", rhino: "#a99f86",
  tiger: "#ff9500", bear: "#e8e6df", turtle: "#39ff14", bird: "#b388ff",
};

export async function GET() {
  const entities: Entity[] = A.map((a) => ({
    uid: "animals:" + a.id,
    layer: "animals",
    id: a.id,
    label: a.name,
    lat: a.lat,
    lng: a.lng,
    altKm: 0,
    color: COLOR[a.group] || "#a0e04d",
    props: {
      Animal: a.name,
      Species: a.species,
      Programme: a.prog,
      Tracking: a.link,
    },
  }));
  return NextResponse.json({ ok: true, source: "Curated public wildlife trackers", entities });
}
