// Unified entity model — Gotham-style: every tracked object is an Entity
// with a dossier of properties, regardless of source layer.

export type LayerId =
  | "aircraft"
  | "satellites"
  | "earthquakes"
  | "launches"
  | "volcanoes"
  | "open-secrets"
  | "wildfires"
  | "vessels"
  | "animals"
  | "webcams"
  | "conflicts"
  | "gdelt"
  | "infrastructure"
  | "live-news"
  | "cyber-attacks"
  | "cables";

export type Entity = {
  uid: string;            // globally unique: `${layer}:${id}`
  layer: LayerId;
  id: string;             // source id
  label: string;          // short display name
  lat: number;
  lng: number;
  altKm: number;          // 0 for ground-level
  color: string;
  ring?: boolean;         // draw a pulse ring (events)
  props: Record<string, string | number>; // dossier fields
  ts?: number;            // event time if applicable
};

export type LayerMeta = {
  id: LayerId;
  name: string;
  glyph: string;
  color: string;
  desc: string;
  needsKey: boolean;
  keyName?: string;
  live: boolean;          // continuously refreshed
};

export const LAYERS: LayerMeta[] = [
  { id: "aircraft",    name: "Aircraft",      glyph: "✈", color: "#4dd0e1", desc: "Live ADS-B (OpenSky)",              needsKey: false, live: true  },
  { id: "satellites",  name: "Satellites",    glyph: "🛰", color: "#ffd23f", desc: "Orbital elements (CelesTrak)",      needsKey: false, live: true  },
  { id: "earthquakes", name: "Earthquakes",   glyph: "◎", color: "#ff9500", desc: "Global seismicity (USGS)",          needsKey: false, live: true  },
  { id: "launches",    name: "Launches",      glyph: "▲", color: "#4de0c8", desc: "Orbital launches (Launch Library 2)", needsKey: false, live: false },
  { id: "volcanoes",   name: "Volcanoes",     glyph: "△", color: "#ff6a00", desc: "Eruptive activity (Smithsonian GVP)", needsKey: false, live: false },
  { id: "open-secrets",name: "Open Secrets",  glyph: "◈", color: "#ff4da6", desc: "Thought secret — actually public (OSINT)", needsKey: false, live: false },
  { id: "wildfires",   name: "Wildfires",     glyph: "◆", color: "#ff7a1a", desc: "Active fire hotspots (NASA FIRMS)", needsKey: true,  keyName: "FIRMS_KEY",   live: true },
  { id: "vessels",     name: "Vessels",       glyph: "⬢", color: "#1de9b6", desc: "Live maritime AIS (AISStream)",     needsKey: false, live: true },
  { id: "animals",     name: "Wildlife",      glyph: "❋", color: "#a0e04d", desc: "Tagged fauna — sharks, whales, elephants, rhinos", needsKey: false, live: false },
  { id: "webcams",     name: "Webcams",       glyph: "⧉", color: "#39ff14", desc: "Curated public livestreams",        needsKey: false, live: false },
  { id: "conflicts",   name: "Conflict Zones",glyph: "✸", color: "#ff3d3d", desc: "Active conflicts (OSINT/liveuamap)",needsKey: false, live: false },
  { id: "gdelt",       name: "Disaster Alerts",glyph: "◇", color: "#b388ff", desc: "Global disasters (GDACS)",          needsKey: false, live: true  },
  { id: "infrastructure",name: "Nuclear/Infra",glyph: "⬡", color: "#00e5ff", desc: "Nuclear power stations (IAEA)",     needsKey: false, live: false },
  { id: "live-news",   name: "Live News TV",  glyph: "▷", color: "#e040fb", desc: "24/7 news livestreams (YouTube)",   needsKey: false, live: false },
  { id: "cyber-attacks",name: "Cyber Threats", glyph: "⚡", color: "#ff9f1c", desc: "Live attack arcs (abuse.ch)",       needsKey: false, live: true  },
  { id: "cables",      name: "Subsea Cables", glyph: "≈", color: "#4aa3ff", desc: "Submarine cables (TeleGeography)",   needsKey: false, live: false },
];

export const LAYER_MAP: Record<LayerId, LayerMeta> = Object.fromEntries(
  LAYERS.map((l) => [l.id, l])
) as Record<LayerId, LayerMeta>;

// Shared imperative camera control, implemented by both globe engines.
export type GlobeControl = {
  zoom: (factor: number) => void;
  reset: () => void;
  flyTo?: (e: Entity) => void;
  flyToPlace?: (lat: number, lng: number) => void;
  intro?: (lat: number, lng: number) => void; // cinematic opening fly-to-you
};
