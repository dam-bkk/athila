"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import nextDynamic from "next/dynamic";
import { LAYERS, type Entity, type LayerId, type GlobeControl } from "@/lib/types";
import { useData } from "@/lib/useData";
import GlobeCanvas from "./GlobeCanvas";

// Heavy 3D engine — load only when the user switches to 3D view.
const CesiumGlobe = nextDynamic(() => import("./CesiumGlobe"), { ssr: false });

const CAPS: Partial<Record<LayerId, number>> = { aircraft: 2500 };

export default function Console() {
  const [satCap, setSatCap] = useState(1200);
  const { layers, log } = useData(satCap);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    aircraft: true,
    satellites: true,
    earthquakes: true,
    launches: true,
    volcanoes: false,
    "open-secrets": true,
  });
  const [selected, setSelected] = useState<Entity | null>(null);
  const [imagery, setImagery] = useState<"night" | "day" | "topo" | "clouds">("night");
  const [rotate, setRotate] = useState(false);
  const [tracks, setTracks] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [mode, setMode] = useState<"globe" | "3d">("globe");
  const [query, setQuery] = useState("");
  const globeApi = useRef<GlobeControl | null>(null);
  const isMobile = useIsMobile();
  useEffect(() => { if (isMobile) setPanelOpen(false); }, [isMobile]);

  // Compose displayed entities from enabled layers (capped for perf)
  const shown = useMemo(() => {
    const out: Entity[] = [];
    for (const l of LAYERS) {
      if (!enabled[l.id]) continue;
      const st = layers[l.id];
      if (!st?.entities?.length) continue;
      const cap = CAPS[l.id];
      out.push(...(cap ? st.entities.slice(0, cap) : st.entities));
    }
    return out;
  }, [layers, enabled]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return shown.filter((e) => e.label.toLowerCase().includes(q)).slice(0, 6);
  }, [query, shown]);

  // City / place geocoding (debounced) → fly-to
  const [places, setPlaces] = useState<{ name: string; lat: number; lng: number }[]>([]);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) { setPlaces([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/geocode?q=" + encodeURIComponent(q));
        const j = await r.json();
        setPlaces(j.places || []);
      } catch { setPlaces([]); }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const flyToPlace = (lat: number, lng: number) => {
    globeApi.current?.flyToPlace?.(lat, lng);
    setQuery("");
    setPlaces([]);
  };

  // Heading vectors: for all visible aircraft when "tracks" is on, plus the
  // selected aircraft highlighted.
  const arcs = useMemo(() => {
    const vec = (e: Entity, color: string[], len: number) => {
      const head = Number(String(e.props.Heading).replace("°", "")) || 0;
      const rad = (head * Math.PI) / 180;
      return {
        startLat: e.lat,
        startLng: e.lng,
        endLat: e.lat + Math.cos(rad) * len,
        endLng: e.lng + Math.sin(rad) * len,
        color,
      };
    };
    const out: ReturnType<typeof vec>[] = [];
    if (tracks) {
      shown
        .filter((e) => e.layer === "aircraft")
        .slice(0, 250)
        .forEach((p) => out.push(vec(p, ["#4de0c8", "rgba(77,224,200,0)"], 2.5)));
    }
    if (selected?.layer === "aircraft") out.push(vec(selected, ["#ffd23f", "#2f6be0"], 4));
    return out;
  }, [tracks, shown, selected]);

  const totalTracked = LAYERS.reduce((a, l) => a + (enabled[l.id] ? layers[l.id]?.count || 0 : 0), 0);
  const countries = new Set(
    (layers.aircraft?.entities || []).map((e) => String(e.props.Country)).filter((p) => p && p !== "—")
  ).size;

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      {mode === "3d" ? (
        <CesiumGlobe entities={shown} selected={selected} onSelect={setSelected} apiRef={globeApi} />
      ) : (
        <GlobeCanvas
          entities={shown}
          selected={selected}
          onSelect={setSelected}
          arcs={arcs}
          imagery={imagery}
          autoRotate={rotate}
          apiRef={globeApi}
        />
      )}

      {/* ===== Left icon rail ===== */}
      <div
        className="glass"
        style={{
          position: "fixed", left: 12, top: 12, bottom: isMobile ? 12 : 92, width: 46, borderRadius: 12,
          display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0", gap: 6, zIndex: 30,
        }}
      >
        <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid var(--accent-hi)", marginBottom: 10 }} className="sweep" />
        <button title="Recentrer la vue" style={railBtn(false)} onClick={() => globeApi.current?.reset()}>◐</button>
        <button title="Afficher/masquer le panneau" style={railBtn(panelOpen)} onClick={() => setPanelOpen((v) => !v)}>▤</button>
        <button title="Open Secrets" style={railBtn(!!enabled["open-secrets"])} onClick={() => setEnabled((s) => ({ ...s, "open-secrets": !s["open-secrets"] }))}>⛨</button>
        <button title="Trajectoires avions" style={railBtn(tracks)} onClick={() => setTracks((v) => !v)}>◎</button>
        <button title="Rotation auto" style={railBtn(rotate)} onClick={() => setRotate((v) => !v)}>⚙</button>
        <div style={{ height: 8 }} />
        <button title="Zoom avant" style={railBtn(false)} onClick={() => globeApi.current?.zoom(0.7)}>+</button>
        <button title="Zoom arrière" style={railBtn(false)} onClick={() => globeApi.current?.zoom(1.4)}>−</button>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 9, color: "var(--dim2)", writingMode: "vertical-rl", letterSpacing: ".3em" }}>
          ATHILA
        </div>
      </div>

      {/* ===== Top bar ===== */}
      <div style={{ position: "fixed", left: 70, top: 12, right: 12, display: "flex", gap: 8, zIndex: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div className="glass" style={{ borderRadius: 12, padding: "10px 16px" }}>
          <div style={{ fontWeight: 700, letterSpacing: ".2em", fontSize: 15 }}>ATHILA</div>
          <div className="eyebrow" style={{ marginTop: 2 }}>Geospatial console · LIVE</div>
        </div>

        {/* search */}
        <div className="glass" style={{ borderRadius: 12, padding: "0 14px", display: "flex", alignItems: "center", minWidth: 240, position: "relative" }}>
          <span style={{ color: "var(--dim)", marginRight: 8 }}>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a city, entity, callsign…"
            style={{ background: "none", border: 0, color: "var(--txt)", outline: "none", width: "100%", fontSize: 12, padding: "11px 0" }}
          />
          {(results.length > 0 || places.length > 0) && query.trim() && (
            <div className="card" style={{ position: "absolute", top: 46, left: 0, right: 0, borderRadius: 10, overflow: "hidden", zIndex: 30, maxHeight: 340, overflowY: "auto" }}>
              {places.map((p, i) => (
                <div key={"pl" + i} onClick={() => flyToPlace(p.lat, p.lng)}
                  style={{ padding: "9px 12px", fontSize: 12, cursor: "pointer", borderBottom: "1px solid var(--line)", display: "flex", gap: 8, alignItems: "center" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(45,107,224,.18)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <span style={{ color: "var(--accent-hi)" }}>📍</span>
                  <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                  <span style={{ color: "var(--dim2)", fontSize: 9.5 }}>fly</span>
                </div>
              ))}
              {results.map((r) => (
                <div key={r.uid} onClick={() => { setSelected(r); globeApi.current?.flyTo?.(r); setQuery(""); setPlaces([]); }}
                  style={{ padding: "9px 12px", fontSize: 12, cursor: "pointer", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.05)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <span>{r.label}</span>
                  <span style={{ color: r.color }}>{r.layer}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* view engine */}
        <div className="glass" style={{ borderRadius: 12, padding: 4, display: "flex", gap: 2 }}>
          <button onClick={() => setMode("globe")} style={segBtn(mode === "globe")}>◍ Globe</button>
          <button onClick={() => setMode("3d")} style={segBtn(mode === "3d")}>◉ 3D</button>
        </div>

        {/* imagery + rotate (globe view only) */}
        {mode === "globe" && (
        <div className="glass" style={{ borderRadius: 12, padding: 4, display: "flex", gap: 2 }}>
          {(["night", "day", "clouds", "topo"] as const).map((m) => (
            <button key={m} onClick={() => setImagery(m)} style={segBtn(imagery === m)}>
              {m === "night" ? "Night" : m === "day" ? "Day" : m === "clouds" ? "Clouds ⛅" : "Terrain"}
            </button>
          ))}
          <button onClick={() => setTracks((t) => !t)} style={segBtn(tracks)}>✈ Tracks</button>
          <button onClick={() => setRotate((r) => !r)} style={segBtn(rotate)}>⟳ Spin</button>
        </div>
        )}

        <div className="glass" style={{ borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <span className="pulse" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--sel)" }} />
          <span className="eyebrow" style={{ color: "var(--sel)" }}>Live feed</span>
        </div>
      </div>

      {/* ===== Left dossier: layers + KPIs ===== */}
      {panelOpen && (
      <div className="glass" style={{ position: "fixed",
        left: isMobile ? 64 : 70, top: isMobile ? 118 : 84,
        width: isMobile ? "calc(100vw - 72px)" : 262,
        bottom: isMobile ? "auto" : 92, maxHeight: isMobile ? "58vh" : undefined,
        borderRadius: 14, padding: 16, overflow: "auto", zIndex: isMobile ? 26 : 15 }}>
        <div className="eyebrow">Inventory · Real-time</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "12px 0 18px" }}>
          <Kpi n={totalTracked.toLocaleString("en")} l="Tracked entities" />
          <Kpi n={String(countries)} l="Countries in view" />
        </div>

        <div className="eyebrow" style={{ marginBottom: 8 }}>Active layers</div>
        {LAYERS.map((l) => {
          const st = layers[l.id];
          const on = !!enabled[l.id];
          return (
            <div key={l.id} onClick={() => !l.needsKey && setEnabled((s) => ({ ...s, [l.id]: !s[l.id] }))}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--line)", cursor: l.needsKey ? "default" : "pointer", opacity: l.needsKey ? 0.5 : 1 }}>
              <span style={{ color: l.color, fontSize: 14, width: 18, textAlign: "center" }}>{l.glyph}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{l.name}</div>
                <div style={{ fontSize: 9.5, color: "var(--dim2)", letterSpacing: ".04em" }}>{l.desc}</div>
              </div>
              {l.needsKey ? (
                <span style={{ fontSize: 8.5, color: "var(--amber)", border: "1px solid var(--line-str)", padding: "2px 5px", borderRadius: 5 }}>KEY</span>
              ) : (
                <>
                  <span className="tabular" style={{ fontSize: 10.5, color: "var(--dim)" }}>{st?.count ? st.count.toLocaleString("en") : "—"}</span>
                  <span style={{ width: 30, height: 17, borderRadius: 9, background: on ? "var(--accent)" : "#1c2740", position: "relative", flex: "none", transition: ".18s" }}>
                    <span style={{ position: "absolute", top: 2, left: on ? 15 : 2, width: 13, height: 13, borderRadius: "50%", background: "#fff", transition: ".18s" }} />
                  </span>
                </>
              )}
            </div>
          );
        })}

        <div className="eyebrow" style={{ margin: "16px 0 6px" }}>Satellite density</div>
        <input type="range" min={200} max={4000} step={200} value={satCap}
          onChange={(e) => setSatCap(+e.target.value)} style={{ width: "100%", accentColor: "var(--accent)" }} />
        <div style={{ fontSize: 10.5, color: "var(--dim2)", marginTop: 4 }}>{satCap.toLocaleString("en")} objects propagated</div>
      </div>
      )}

      {/* ===== Right entity dossier ===== */}
      {selected && (
        <div className="glass" style={{ position: "fixed",
          right: isMobile ? 8 : 12, left: isMobile ? 8 : undefined,
          top: isMobile ? undefined : 84, bottom: isMobile ? 8 : undefined,
          width: isMobile ? "auto" : 288,
          borderRadius: 14, padding: 16, zIndex: 28,
          maxHeight: isMobile ? "52vh" : "calc(100vh - 190px)", overflow: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="eyebrow" style={{ color: selected.color }}>{selected.layer}</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, lineHeight: 1.1 }}>{selected.label}</div>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: 0, color: "var(--dim)", fontSize: 20 }}>×</button>
          </div>
          <div style={{ margin: "14px 0", height: 1, background: "var(--line)" }} />
          {Object.entries(selected.props).map(([k, v]) => {
            const val = String(v);
            const isUrl = /^https?:\/\//.test(val);
            const isImg = isUrl && (k.includes("Snapshot") || /imgproxy|\.jpe?g($|\?)/.test(val));
            const isEmbed = isUrl && k.includes("Live feed") && /windy\.com|\/embed/.test(val);
            if (isEmbed) {
              return (
                <div key={k} style={{ margin: "8px 0" }}>
                  <div className="eyebrow" style={{ marginBottom: 6 }}>Live feed</div>
                  <div style={{ position: "relative", width: "100%", paddingBottom: "56%", borderRadius: 8, overflow: "hidden", border: "1px solid var(--line)" }}>
                    <iframe src={val} title={selected.label} allow="autoplay; fullscreen"
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
                  </div>
                  <a href={val} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10.5, color: "var(--accent-hi)", textDecoration: "none" }}>Plein écran ↗</a>
                </div>
              );
            }
            if (isImg) {
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <a key={k} href={val} target="_blank" rel="noopener noreferrer" style={{ display: "block", margin: "8px 0" }}>
                  <img src={val} alt={selected.label} style={{ width: "100%", borderRadius: 8, border: "1px solid var(--line)", display: "block" }} />
                </a>
              );
            }
            return (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--line)", fontSize: 12 }}>
                <span style={{ color: "var(--dim)", flex: "none" }}>{k}</span>
                {isUrl ? (
                  <a href={val} target="_blank" rel="noopener noreferrer"
                    style={{ color: "var(--accent-hi)", fontWeight: 600, textAlign: "right", textDecoration: "none" }}>
                    Open live ↗
                  </a>
                ) : (
                  <b className="tabular" style={{ fontWeight: 600, textAlign: "right", maxWidth: 170 }}>{val}</b>
                )}
              </div>
            );
          })}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 11, color: "var(--dim2)" }}>
            <span className="mono">{selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}</span>
            <span className="mono">ALT {Math.round(selected.altKm)} km</span>
          </div>
        </div>
      )}

      {/* ===== Bottom timeline / status (desktop only) ===== */}
      {!isMobile && (
      <div className="glass" style={{ position: "fixed", left: 70, right: 12, bottom: 12, height: 68, borderRadius: 14, zIndex: 15, display: "flex", alignItems: "center", padding: "0 18px", gap: 20 }}>
        <div>
          <div className="eyebrow">UTC clock</div>
          <Clock />
        </div>
        <div style={{ width: 1, height: 34, background: "var(--line)" }} />
        <div style={{ flex: 1, position: "relative", height: 34 }}>
          <div style={{ position: "absolute", top: 8, left: 0, right: 0, height: 2, background: "var(--line-str)" }} />
          {LAYERS.filter((l) => enabled[l.id]).map((l, i) => (
            <span key={l.id} style={{ position: "absolute", top: 3, left: `${8 + i * 12}%`, width: 8, height: 8, borderRadius: "50%", background: l.color, boxShadow: `0 0 10px ${l.color}` }} />
          ))}
          <div style={{ position: "absolute", bottom: 0, left: 0, fontSize: 9.5, color: "var(--dim2)" }}>
            All data shown is public, unclassified and for demonstration purposes — open feeds only.
          </div>
        </div>
        <button style={{ ...segBtn(false), padding: "7px 14px" }}>⏸ 1×</button>
        <button style={{ ...segBtn(true), padding: "7px 14px" }}>▶ Go Live</button>
      </div>
      )}

      {/* ===== Live log (desktop only) ===== */}
      <div className="glass" style={{ position: "fixed", right: 12, bottom: 92, width: 288, borderRadius: 12, padding: "10px 12px", zIndex: 14, display: isMobile || selected ? "none" : "block" }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>System feed</div>
        {log.length === 0 && <div style={{ fontSize: 11, color: "var(--dim2)" }} className="mono">initializing…</div>}
        {log.map((l, i) => (
          <div key={i} className="mono" style={{ fontSize: 10.5, color: i === 0 ? "var(--teal)" : "var(--dim)", padding: "2px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l}</div>
        ))}
      </div>
    </div>
  );
}

function Kpi({ n, l }: { n: string; l: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 11px" }}>
      <div className="tabular" style={{ fontSize: 21, fontWeight: 700, lineHeight: 1 }}>{n}</div>
      <div className="eyebrow" style={{ marginTop: 5, fontSize: 8.5 }}>{l}</div>
    </div>
  );
}

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 820px)");
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return m;
}

function Clock() {
  const [t, setT] = useState("--:--:--");
  useEffect(() => {
    const tick = () => setT(new Date().toISOString().slice(11, 19));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <div className="mono tabular" style={{ fontSize: 17, fontWeight: 600 }}>{t}</div>;
}

const railBtn = (on: boolean): React.CSSProperties => ({
  width: 32, height: 32, borderRadius: 8, border: "1px solid var(--line)",
  background: on ? "var(--accent)" : "transparent", color: on ? "#fff" : "var(--dim)", fontSize: 14,
});
const segBtn = (on: boolean): React.CSSProperties => ({
  border: 0, background: on ? "var(--accent)" : "transparent", color: on ? "#fff" : "var(--dim)",
  fontSize: 11, padding: "8px 11px", borderRadius: 8, letterSpacing: ".02em",
});
