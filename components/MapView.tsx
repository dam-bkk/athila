"use client";

import { useEffect, useRef } from "react";
import maplibregl, {
  type Map as MlMap,
  type StyleSpecification,
  type GeoJSONSource,
  type LngLatLike,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Entity, GlobeControl } from "@/lib/types";

export type Basemap = "dark" | "satellite" | "streets";

type Arc = { startLat: number; startLng: number; endLat: number; endLng: number; color: string[] };

const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

// Base styles. Dark + streets are OpenFreeMap vector tiles (crisp at any zoom,
// key-free). Satellite is Esri World Imagery raster with vector place labels on
// top. All get the globe projection applied on load.
function baseStyle(map: Basemap): string | StyleSpecification {
  if (map === "dark") return "https://tiles.openfreemap.org/styles/dark";
  if (map === "streets") return "https://tiles.openfreemap.org/styles/liberty";
  // satellite
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      esri: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: "Esri, Maxar, Earthstar Geographics",
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#04060b" } },
      { id: "esri", type: "raster", source: "esri" },
    ],
  };
}

const EMPTY = { type: "FeatureCollection", features: [] as GeoJSON.Feature[] } as const;

export default function MapView({
  entities,
  selected,
  onSelect,
  arcs,
  imagery = "dark",
  autoRotate = false,
  apiRef,
}: {
  entities: Entity[];
  selected: Entity | null;
  onSelect: (e: Entity | null) => void;
  arcs: Arc[];
  imagery?: Basemap;
  autoRotate?: boolean;
  apiRef?: React.MutableRefObject<GlobeControl | null>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const entitiesRef = useRef<Entity[]>(entities);
  const arcsRef = useRef<Arc[]>(arcs);
  const selectedRef = useRef<Entity | null>(selected);
  const onSelectRef = useRef(onSelect);
  entitiesRef.current = entities;
  arcsRef.current = arcs;
  selectedRef.current = selected;
  onSelectRef.current = onSelect;

  // ---- GeoJSON builders ----
  const entityFC = (): GeoJSON.FeatureCollection => ({
    type: "FeatureCollection",
    features: entitiesRef.current.map((e) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [e.lng, e.lat] },
      properties: {
        uid: e.uid,
        color: e.color,
        label: e.label,
        layer: e.layer,
        r: e.layer === "satellites" ? 2.4 : e.ring ? 4 : 3.4,
        sel: selectedRef.current?.uid === e.uid ? 1 : 0,
      },
    })),
  });

  const arcFC = (): GeoJSON.FeatureCollection => ({
    type: "FeatureCollection",
    features: arcsRef.current.map((a) => ({
      type: "Feature",
      geometry: { type: "LineString", coordinates: greatCircle(a.startLng, a.startLat, a.endLng, a.endLat) },
      properties: { color: a.color[0] },
    })),
  });

  const pushData = () => {
    const m = mapRef.current;
    if (!m || !m.getSource("entities")) return;
    (m.getSource("entities") as GeoJSONSource).setData(entityFC());
    (m.getSource("arcs") as GeoJSONSource | undefined)?.setData(arcFC());
    (m.getSource("terminator") as GeoJSONSource | undefined)?.setData(terminatorFC());
  };

  // Install our overlay sources + layers onto whatever base style is loaded.
  const install = () => {
    const m = mapRef.current;
    if (!m) return;
    try {
      m.setProjection({ type: "globe" });
    } catch {}

    if (!m.getSource("terminator")) {
      m.addSource("terminator", { type: "geojson", data: terminatorFC() });
      m.addLayer({
        id: "terminator",
        type: "fill",
        source: "terminator",
        paint: { "fill-color": "#000010", "fill-opacity": 0.42 },
      });
    }
    if (!m.getSource("arcs")) {
      m.addSource("arcs", { type: "geojson", data: EMPTY as GeoJSON.FeatureCollection });
      m.addLayer({
        id: "arcs",
        type: "line",
        source: "arcs",
        paint: { "line-color": ["get", "color"], "line-width": 1.2, "line-opacity": 0.7 },
      });
    }
    if (!m.getSource("entities")) {
      m.addSource("entities", { type: "geojson", data: EMPTY as GeoJSON.FeatureCollection });
      // glow halo
      m.addLayer({
        id: "entity-glow",
        type: "circle",
        source: "entities",
        paint: {
          "circle-color": ["get", "color"],
          "circle-blur": 1,
          "circle-opacity": 0.5,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, ["*", ["get", "r"], 1.6], 6, ["*", ["get", "r"], 3]],
        },
      });
      // core dot
      m.addLayer({
        id: "entity-points",
        type: "circle",
        source: "entities",
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 0, ["get", "r"], 6, ["*", ["get", "r"], 1.8]],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": ["case", ["==", ["get", "sel"], 1], 2, 0],
        },
      });
      // labels (appear when zoomed in)
      m.addLayer({
        id: "entity-labels",
        type: "symbol",
        source: "entities",
        minzoom: 4.5,
        layout: {
          "text-field": ["get", "label"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 10,
          "text-offset": [0, 1.1],
          "text-anchor": "top",
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#e8ecf4",
          "text-halo-color": "#05070d",
          "text-halo-width": 1.4,
        },
      });
    }
    pushData();
  };

  // ---- init map once ----
  useEffect(() => {
    if (mapRef.current || !wrapRef.current) return;
    const m = new maplibregl.Map({
      container: wrapRef.current,
      style: baseStyle(imagery),
      center: [10, 25],
      zoom: 1.6,
      attributionControl: { compact: true },
      maxPitch: 0,
    });
    mapRef.current = m;
    m.on("style.load", install);

    m.on("click", "entity-points", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const uid = f.properties?.uid as string;
      const hit = entitiesRef.current.find((x) => x.uid === uid);
      if (hit) onSelectRef.current(hit);
    });
    m.on("click", (e) => {
      const hits = m.queryRenderedFeatures(e.point, { layers: ["entity-points"] });
      if (!hits.length) onSelectRef.current(null);
    });
    m.on("mouseenter", "entity-points", () => (m.getCanvas().style.cursor = "pointer"));
    m.on("mouseleave", "entity-points", () => (m.getCanvas().style.cursor = ""));

    // imperative control surface for the parent (rail buttons, search fly-to)
    if (apiRef) {
      apiRef.current = {
        zoom: (factor: number) => m.zoomTo(m.getZoom() + (factor < 1 ? 1 : -1), { duration: 300 }),
        reset: () => m.flyTo({ center: [10, 25] as LngLatLike, zoom: 1.6, duration: 900 }),
        flyTo: (ent: Entity) => m.flyTo({ center: [ent.lng, ent.lat] as LngLatLike, zoom: 5, duration: 1200 }),
        flyToPlace: (lat: number, lng: number) =>
          m.flyTo({ center: [lng, lat] as LngLatLike, zoom: 9, duration: 1400 }),
      };
    }
    return () => {
      m.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- basemap switch ----
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    // transformStyle preserves our overlay sources+layers across the swap
    m.setStyle(baseStyle(imagery), {
      diff: false,
      transformStyle: (_prev, next) => ({ ...next, projection: { type: "globe" } }),
    });
    // install() re-runs on the ensuing style.load
  }, [imagery]);

  // ---- data updates ----
  useEffect(() => {
    pushData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities, arcs, selected]);

  // ---- auto-rotate ----
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !autoRotate) return;
    let raf = 0;
    let last = performance.now();
    const spin = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const c = m.getCenter();
      m.setCenter([c.lng + dt * 4, c.lat]);
      raf = requestAnimationFrame(spin);
    };
    raf = requestAnimationFrame(spin);
    return () => cancelAnimationFrame(raf);
  }, [autoRotate]);

  return <div ref={wrapRef} style={{ position: "absolute", inset: 0, background: "#04060b" }} />;
}

// Great-circle interpolation → smooth arc as a LineString.
function greatCircle(lng1: number, lat1: number, lng2: number, lat2: number, n = 48): number[][] {
  const toR = Math.PI / 180;
  const φ1 = lat1 * toR, λ1 = lng1 * toR, φ2 = lat2 * toR, λ2 = lng2 * toR;
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2
      )
    );
  if (!d) return [[lng1, lat1], [lng2, lat2]];
  const out: number[][] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    out.push([Math.atan2(y, x) / toR, Math.atan2(z, Math.sqrt(x * x + y * y)) / toR]);
  }
  return out;
}

// Night-side polygon from the current subsolar point (approximate terminator).
function terminatorFC(): GeoJSON.FeatureCollection {
  const now = new Date();
  const toR = Math.PI / 180, toD = 180 / Math.PI;
  const dayMs = now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 0);
  const dayOfYear = dayMs / 86400000;
  const decl = -23.44 * Math.cos(toR * (360 / 365) * (dayOfYear + 10));
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  const sunLng = -15 * (utcHours - 12);
  const ring: number[][] = [];
  for (let lng = -180; lng <= 180; lng += 2) {
    const H = (lng - sunLng) * toR;
    const latT = Math.atan(-Math.cos(H) / Math.tan(decl * toR)) * toD;
    ring.push([lng, latT]);
  }
  // close the polygon over the pole away from the sun
  const northNight = decl < 0;
  const cap = northNight ? 90 : -90;
  ring.push([180, cap], [-180, cap], ring[0]);
  return {
    type: "FeatureCollection",
    features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: {} }],
  };
}
