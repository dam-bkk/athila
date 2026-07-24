"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as satellite from "satellite.js";
import type { Entity, LayerId } from "./types";

type Tle = { name: string; l1: string; l2: string; group: string };
type ApiResp = { ok: boolean; source?: string; entities?: Entity[]; tles?: Tle[]; error?: string };

export type LayerState = {
  entities: Entity[];
  source: string;
  status: "idle" | "loading" | "ok" | "error" | "keyless";
  count: number;
};

const REST_LAYERS: LayerId[] = [
  "aircraft", "earthquakes", "launches", "volcanoes", "open-secrets", "webcams", "vessels",
  "conflicts", "gdelt", "infrastructure", "live-news", "animals",
];
const LIVE_MS: Partial<Record<LayerId, number>> = {
  aircraft: 15000,
  earthquakes: 60000,
  vessels: 15000,
  gdelt: 300000,
};

export function useData(satCap: number) {
  const [layers, setLayers] = useState<Record<string, LayerState>>({});
  const satRecs = useRef<{ rec: satellite.SatRec; name: string; group: string }[]>([]);
  const [sats, setSats] = useState<Entity[]>([]);
  const [satCount, setSatCount] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  const addLog = useCallback((m: string) => {
    setLog((l) => [m, ...l].slice(0, 8));
  }, []);

  const setLayer = (id: string, p: Partial<LayerState>) =>
    setLayers((s) => {
      const cur: LayerState = s[id] ?? { entities: [], source: "", status: "idle", count: 0 };
      return { ...s, [id]: { ...cur, ...p } };
    });

  const fetchRest = useCallback(
    async (id: LayerId) => {
      setLayer(id, { status: "loading" });
      try {
        const r = await fetch(`/api/${id}`, { cache: "no-store" });
        const j = (await r.json()) as ApiResp;
        if (!j.ok || !j.entities) throw new Error(j.error || "no data");
        setLayer(id, {
          entities: j.entities,
          source: j.source || "",
          status: "ok",
          count: j.entities.length,
        });
        addLog(`▸ ${id} — ${j.entities.length} entities (${j.source})`);
      } catch {
        setLayer(id, { status: "error" });
        addLog(`✕ ${id} unavailable`);
      }
    },
    [addLog]
  );

  // Satellites: load TLE once, then propagate on a timer
  const loadTle = useCallback(async () => {
    setLayer("satellites", { status: "loading" });
    try {
      const r = await fetch("/api/satellites", { cache: "no-store" });
      const j = (await r.json()) as ApiResp;
      if (!j.ok || !j.tles) throw new Error("tle");
      satRecs.current = j.tles
        .map((t) => {
          try {
            return { rec: satellite.twoline2satrec(t.l1, t.l2), name: t.name, group: t.group };
          } catch {
            return null;
          }
        })
        .filter(Boolean) as { rec: satellite.SatRec; name: string; group: string }[];
      setSatCount(satRecs.current.length);
      setLayer("satellites", { status: "ok", source: "CelesTrak", count: satRecs.current.length });
      addLog(`▸ satellites — ${satRecs.current.length} TLE (CelesTrak)`);
    } catch {
      setLayer("satellites", { status: "error" });
      addLog("✕ satellite TLE unavailable");
    }
  }, [addLog]);

  const propagate = useCallback(() => {
    const recs = satRecs.current;
    if (!recs.length) return;
    const now = new Date();
    const gmst = satellite.gstime(now);
    const out: Entity[] = [];
    const n = Math.min(satCap, recs.length);
    for (let i = 0; i < n; i++) {
      const s = recs[i];
      try {
        const pv = satellite.propagate(s.rec, now);
        if (!pv || !pv.position || typeof pv.position === "boolean") continue;
        const gd = satellite.eciToGeodetic(pv.position as satellite.EciVec3<number>, gmst);
        const altKm = gd.height;
        if (!isFinite(altKm)) continue;
        out.push({
          uid: "satellites:" + s.name,
          layer: "satellites",
          id: s.name,
          label: s.name,
          lat: satellite.degreesLat(gd.latitude),
          lng: satellite.degreesLong(gd.longitude),
          altKm,
          color: altKm > 30000 ? "#4de0c8" : altKm > 2000 ? "#7c9cff" : "#9db4ff",
          props: {
            Object: s.name,
            Group: s.group,
            Altitude: Math.round(altKm) + " km",
            Regime: altKm > 30000 ? "GEO" : altKm > 2000 ? "MEO" : "LEO",
          },
        });
      } catch {
        /* decayed */
      }
    }
    setSats(out);
  }, [satCap]);

  // boot
  useEffect(() => {
    REST_LAYERS.forEach(fetchRest);
    loadTle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // live refresh timers
  useEffect(() => {
    const timers = Object.entries(LIVE_MS).map(([id, ms]) =>
      setInterval(() => fetchRest(id as LayerId), ms)
    );
    return () => timers.forEach(clearInterval);
  }, [fetchRest]);

  // satellite propagation loop — 6s is smooth enough for orbital motion at
  // globe scale and keeps CPU/GPU idle between ticks (avoid overheating).
  useEffect(() => {
    propagate();
    const t = setInterval(propagate, 6000);
    return () => clearInterval(t);
  }, [propagate]);

  const merged: Record<string, LayerState> = {
    ...layers,
    satellites: {
      ...(layers.satellites || { source: "CelesTrak", status: "ok" }),
      entities: sats,
      count: satCount,
    } as LayerState,
  };

  return { layers: merged, log, refetch: fetchRest };
}
