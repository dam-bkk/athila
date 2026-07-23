"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Entity } from "@/lib/types";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

const IMAGERY: Record<string, string> = {
  night: "//unpkg.com/three-globe/example/img/earth-night.jpg",
  day: "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
  topo: "//unpkg.com/three-globe/example/img/earth-topology.png",
  clouds: "/api/earth-texture", // real NASA GIBS true-color w/ today's clouds
};

type Arc = {
  startLat: number; startLng: number; endLat: number; endLng: number; color: string[];
};

export default function GlobeCanvas({
  entities,
  selected,
  onSelect,
  arcs,
  imagery = "night",
  autoRotate,
}: {
  entities: Entity[];
  selected: Entity | null;
  onSelect: (e: Entity | null) => void;
  arcs: Arc[];
  imagery?: keyof typeof IMAGERY;
  autoRotate: boolean;
}) {
  const globeRef = useRef<any>(null);
  const [dim, setDim] = useState({ w: 800, h: 600 });
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDim({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setDim({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const c = g.controls();
    c.autoRotate = autoRotate;
    c.autoRotateSpeed = 0.22;
    c.enableDamping = true;
  }, [autoRotate]);

  // Fly to selected entity
  useEffect(() => {
    const g = globeRef.current;
    if (!g || !selected) return;
    g.pointOfView(
      { lat: selected.lat, lng: selected.lng, altitude: selected.altKm > 2000 ? 2.4 : 1.4 },
      900
    );
  }, [selected]);

  const rings = useMemo(
    () => entities.filter((e) => e.ring).map((e) => ({ lat: e.lat, lng: e.lng, color: e.color })),
    [entities]
  );

  return (
    <div ref={wrapRef} style={{ position: "absolute", inset: 0 }}>
      <Globe
        ref={globeRef}
        width={dim.w}
        height={dim.h}
        globeImageUrl={IMAGERY[imagery]}
        bumpImageUrl={IMAGERY.topo}
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        atmosphereColor="#4d86ff"
        atmosphereAltitude={0.24}
        // points = all entities
        pointsData={entities}
        pointLat="lat"
        pointLng="lng"
        pointAltitude={(d: any) => Math.min(2.2, d.altKm / 6371) + 0.006}
        pointColor="color"
        pointRadius={(d: any) => (d.uid === selected?.uid ? 0.42 : d.altKm > 100 ? 0.16 : 0.2)}
        pointResolution={4}
        pointsMerge={false}
        pointLabel={(d: any) => `<div style="font:12px ui-sans-serif;color:#e6edf7;background:rgba(10,17,32,.9);border:1px solid rgba(120,160,220,.3);padding:5px 8px;border-radius:6px;backdrop-filter:blur(6px)">${d.label}</div>`}
        onPointClick={(d: any) => onSelect(d as Entity)}
        // pulsing rings for events
        ringsData={rings}
        ringColor={(d: any) => (t: number) => `${d.color}${Math.round((1 - t) * 200).toString(16).padStart(2, "0")}`}
        ringMaxRadius={3.2}
        ringPropagationSpeed={1.4}
        ringRepeatPeriod={1400}
        // selected orbit / heading vector
        arcsData={arcs}
        arcColor="color"
        arcStroke={0.5}
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={3000}
        arcAltitudeAutoScale={0.4}
        onGlobeClick={() => onSelect(null)}
      />
    </div>
  );
}
