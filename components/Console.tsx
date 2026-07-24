"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import nextDynamic from "next/dynamic";
import { LAYERS, type Entity, type LayerId, type GlobeControl } from "@/lib/types";
import { useData } from "@/lib/useData";
import type { Basemap } from "./MapView";

// MapLibre GL engine (globe projection + vector tiles) — client-only.
const MapView = nextDynamic(() => import("./MapView"), { ssr: false });

const CAPS: Partial<Record<LayerId, number>> = { aircraft: 2500, vessels: 3000 };

// Left-rail quick layer toggles (osiris category icons; non-emoji glyphs).
const RAIL: { id: LayerId; icon: string; label: string }[] = [
  { id: "aircraft", icon: "✈", label: "Flights" },
  { id: "vessels", icon: "⚓", label: "Maritime" },
  { id: "satellites", icon: "✦", label: "Satellites" },
  { id: "webcams", icon: "◉", label: "CCTV" },
  { id: "cables", icon: "≈", label: "Subsea cables" },
  { id: "conflicts", icon: "✸", label: "Conflicts" },
  { id: "cyber-attacks", icon: "⚡", label: "Cyber threats" },
  { id: "infrastructure", icon: "⬡", label: "Nuclear" },
  { id: "gdelt", icon: "◇", label: "Disasters" },
  { id: "live-news", icon: "▷", label: "News TV" },
  { id: "animals", icon: "❋", label: "Wildlife" },
];

export default function Console() {
  const [satCap, setSatCap] = useState(1200);
  const { layers, log } = useData(satCap);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    aircraft: true, satellites: true, earthquakes: true, launches: true,
    volcanoes: false, "open-secrets": true, conflicts: true, infrastructure: true,
    gdelt: false, "live-news": false, cables: true,
  });
  const [selected, setSelected] = useState<Entity | null>(null);
  const [imagery, setImagery] = useState<Basemap>("dark");
  const [projection, setProjection] = useState<"globe" | "flat">("globe");
  const [rotate, setRotate] = useState(false);
  const [tracks, setTracks] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [osintOpen, setOsintOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [localCams, setLocalCams] = useState<Entity[]>([]);
  const [cyberArcs, setCyberArcs] = useState<Arc[]>([]);
  const [cursor, setCursor] = useState({ lat: 0, lng: 0, zoom: 1.6 });
  const [place, setPlace] = useState("");
  const [kp, setKp] = useState<{ kp: number; color: string; level: string }>({ kp: 0, color: "#00e676", level: "—" });
  const [markets, setMarkets] = useState<Record<string, number>>({});
  const [acPhoto, setAcPhoto] = useState<{ photo: string; credit: string; link: string; source: string } | null>(null);
  const globeApi = useRef<GlobeControl | null>(null);
  const isMobile = useIsMobile();
  useEffect(() => { if (isMobile) { setPanelOpen(false); setOsintOpen(false); } }, [isMobile]);

  // Compose displayed entities from enabled layers (capped for perf)
  const shown = useMemo(() => {
    const out: Entity[] = [];
    const uids = new Set<string>();
    for (const l of LAYERS) {
      if (!enabled[l.id]) continue;
      const st = layers[l.id];
      if (!st?.entities?.length) continue;
      const cap = CAPS[l.id];
      for (const e of cap ? st.entities.slice(0, cap) : st.entities) { uids.add(e.uid); out.push(e); }
    }
    if (enabled["webcams"]) for (const e of localCams) if (!uids.has(e.uid)) out.push(e);
    return out;
  }, [layers, enabled, localCams]);

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

  const flyToPlace = async (lat: number, lng: number) => {
    globeApi.current?.flyToPlace?.(lat, lng);
    setQuery(""); setPlaces([]);
    try {
      const r = await fetch(`/api/webcams?near=${lat.toFixed(4)},${lng.toFixed(4)}`);
      const j = await r.json();
      if (j.entities?.length) { setLocalCams(j.entities); setEnabled((s) => ({ ...s, webcams: true })); }
    } catch { /* ignore */ }
  };

  // Opening animation: geolocate the visitor and cinematically fly to them.
  const introDone = useRef(false);
  useEffect(() => {
    let tries = 0, cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/geoip", { cache: "no-store" });
        const j = await r.json();
        if (cancelled || !j.ok) return;
        setPlace([j.city, j.country].filter(Boolean).join(", "));
        if (introDone.current) return;
        const fly = () => {
          if (cancelled) return;
          if (globeApi.current?.intro) {
            introDone.current = true;
            setTimeout(() => globeApi.current?.intro?.(j.lat, j.lng), 900);
          } else if (tries++ < 40) setTimeout(fly, 150);
        };
        fly();
      } catch { /* stay on world view */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Space weather (Kp) for the HUD + markets for the ticker.
  useEffect(() => {
    const loadKp = () => fetch("/api/space-weather").then((r) => r.json()).then((j) => j.ok && setKp(j)).catch(() => {});
    const loadMk = () => fetch("/api/markets").then((r) => r.json()).then((j) => j.crypto && setMarkets(j.crypto)).catch(() => {});
    loadKp(); loadMk();
    const a = setInterval(() => !document.hidden && loadKp(), 600_000), b = setInterval(() => !document.hidden && loadMk(), 60_000);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);

  // Representative image for the selected object (planespotters for aircraft,
  // Wikipedia thumbnail for everything else).
  useEffect(() => {
    setAcPhoto(null);
    if (!selected) return;
    let alive = true;
    const p = new URLSearchParams({ layer: selected.layer, label: selected.label, id: selected.id });
    fetch("/api/entity-image?" + p.toString())
      .then((r) => r.json())
      .then((j) => { if (alive && j.ok) setAcPhoto({ photo: j.image, credit: j.credit, link: j.link, source: j.source }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [selected]);

  // Cyber-attack arcs: fetch when the layer is on, refresh for a live feel.
  useEffect(() => {
    if (!enabled["cyber-attacks"]) { setCyberArcs([]); return; }
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/cyber-attacks", { cache: "no-store" });
        const j = await r.json();
        if (alive && j.arcs) setCyberArcs(j.arcs.map((a: { startLat: number; startLng: number; endLat: number; endLng: number; color: string }) =>
          ({ startLat: a.startLat, startLng: a.startLng, endLat: a.endLat, endLng: a.endLng, color: [a.color, a.color] })));
      } catch { /* ignore */ }
    };
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 6000);
    return () => { alive = false; clearInterval(t); };
  }, [enabled]);

  // Heading / course vectors: aircraft tracks, selected plane/ship course, cyber.
  const arcs = useMemo<Arc[]>(() => {
    const vec = (e: Entity, color: string[], len: number): Arc => {
      const head = Number(String(e.props.Heading).replace("°", "")) || 0;
      const rad = (head * Math.PI) / 180;
      return { startLat: e.lat, startLng: e.lng, endLat: e.lat + Math.cos(rad) * len, endLng: e.lng + Math.sin(rad) * len, color };
    };
    const out: Arc[] = [];
    if (tracks) shown.filter((e) => e.layer === "aircraft").slice(0, 250)
      .forEach((p) => out.push(vec(p, ["#4de0c8", "rgba(77,224,200,0)"], 2.5)));
    if (selected?.layer === "aircraft") out.push(vec(selected, ["#ffd23f", "#2f6be0"], 4));
    if (selected?.layer === "vessels") out.push(vec(selected, ["#39c0ff", "rgba(57,192,255,0)"], 3));
    for (const c of cyberArcs) out.push(c);
    return out;
  }, [tracks, shown, selected, cyberArcs]);

  const totalTracked = LAYERS.reduce((a, l) => a + (enabled[l.id] ? layers[l.id]?.count || 0 : 0), 0);

  // Ticker items: latest quakes + crypto.
  const tickerItems = useMemo(() => {
    const quakes = (layers.earthquakes?.entities || []).slice(0, 10)
      .map((e) => ({ c: e.color, t: `${e.props.Magnitude ?? "M?"} ${e.label}` }));
    const crypto = Object.entries(markets).map(([k, v]) => ({
      c: "#f7931a", t: `${k} $${v >= 1000 ? (v / 1000).toFixed(1) + "K" : v.toFixed(2)}`,
    }));
    return [...crypto, ...quakes];
  }, [layers.earthquakes, markets]);

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <MapView
        entities={shown} selected={selected} onSelect={setSelected} arcs={arcs}
        imagery={imagery} autoRotate={rotate} showCables={!!enabled["cables"]}
        projection={projection} onCursor={(lat, lng, zoom) => setCursor({ lat, lng, zoom })}
        apiRef={globeApi}
      />

      {/* ===== Top HUD bar ===== */}
      <div className="hud" style={{ position: "fixed", left: 0, right: 0, top: 0, height: 54, zIndex: 30,
        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 0 60px",
        background: "linear-gradient(180deg, rgba(4,4,10,.92), rgba(4,4,10,.55) 70%, transparent)", pointerEvents: "none" }}>
        {/* wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, pointerEvents: "auto" }}>
          <EyeLogo />
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: ".42em", color: "var(--gold)" }}>ARGOS</div>
            <div className="track" style={{ fontSize: 8 }}>Open Source Intelligence</div>
          </div>
          {!isMobile && (
            <div className="track" style={{ marginLeft: 14, fontSize: 8.5, color: "var(--dim2)" }}>
              REAL-TIME · FLIGHTS · MARITIME · SATELLITES · CCTV · CABLES · CYBER
            </div>
          )}
        </div>
        {/* center status */}
        {!isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 11, letterSpacing: ".1em", pointerEvents: "auto" }}>
            <span style={{ color: "var(--gold)" }}>ZULU <ZuluClock /></span>
            <span style={{ color: "var(--dim)" }}>STATUS <b className="pulse" style={{ color: "var(--green)" }}>LIVE</b></span>
            <span style={{ color: "var(--dim)" }}><b className="tabular" style={{ color: "var(--txt)" }}>{totalTracked.toLocaleString("en")}</b> ENTITIES</span>
            <span style={{ color: "var(--dim)" }}>SOLAR <b style={{ color: kp.color }}>Kp{kp.kp}</b></span>
            <span style={{ color: "var(--dim2)" }}>V.ARGOS</span>
          </div>
        )}
        {/* right */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, pointerEvents: "auto" }}>
          <button onClick={() => setOsintOpen((v) => !v)} style={pill(osintOpen)}>◎ OSINT</button>
          <a href="https://argos.damien.asia" target="_blank" rel="noopener noreferrer" style={{ ...pill(false), textDecoration: "none" }}>● LIVE</a>
        </div>
      </div>

      {/* ===== Left icon rail (layer toggles) ===== */}
      <div className="glass" style={{ position: "fixed", left: 10, top: 62, bottom: 78, width: 44, borderRadius: 12,
        display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 0", gap: 3, zIndex: 28, overflowY: "auto" }}>
        <button title="Layers panel" style={railBtn(panelOpen)} onClick={() => setPanelOpen((v) => !v)}>▤</button>
        <div style={{ height: 4 }} />
        {RAIL.map((r) => (
          <button key={r.id} title={r.label} style={{ ...railBtn(!!enabled[r.id]), color: enabled[r.id] ? "#0a0b10" : (LAYERS.find((l) => l.id === r.id)?.color || "var(--dim)") }}
            onClick={() => setEnabled((s) => ({ ...s, [r.id]: !s[r.id] }))}>{r.icon}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button title="Reset view" style={railBtn(false)} onClick={() => globeApi.current?.reset()}>◐</button>
        <button title="Spin" style={railBtn(rotate)} onClick={() => setRotate((v) => !v)}>⟳</button>
      </div>

      {/* ===== Search (top, under HUD) ===== */}
      <div className="glass" style={{ position: "fixed", left: isMobile ? 62 : 64, top: 62, width: isMobile ? "calc(100vw - 74px)" : 300,
        borderRadius: 10, padding: "0 12px", display: "flex", alignItems: "center", zIndex: 26 }}>
        <span style={{ color: "var(--dim)", marginRight: 8 }}>⌕</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search place, entity, callsign…"
          style={{ background: "none", border: 0, color: "var(--txt)", outline: "none", width: "100%", fontSize: 12, padding: "10px 0" }} />
        {(results.length > 0 || places.length > 0) && query.trim() && (
          <div className="card" style={{ position: "absolute", top: 42, left: 0, right: 0, borderRadius: 8, overflow: "hidden", zIndex: 30, maxHeight: 320, overflowY: "auto" }}>
            {places.map((p, i) => (
              <div key={"pl" + i} onClick={() => flyToPlace(p.lat, p.lng)}
                style={rowStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                <span style={{ color: "var(--gold)" }}>⌖</span>
                <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                <span style={{ color: "var(--dim2)", fontSize: 9.5 }}>fly</span>
              </div>
            ))}
            {results.map((r) => (
              <div key={r.uid} onClick={() => { setSelected(r); globeApi.current?.flyTo?.(r); setQuery(""); setPlaces([]); }}
                style={{ ...rowStyle, justifyContent: "space-between" }} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                <span>{r.label}</span><span style={{ color: r.color }}>{r.layer}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== Left layers panel ===== */}
      {panelOpen && (
        <div className="glass" style={{ position: "fixed", left: 62, top: 104, width: isMobile ? "calc(100vw - 74px)" : 264,
          bottom: isMobile ? "auto" : 78, maxHeight: isMobile ? "56vh" : undefined, borderRadius: 12, padding: 14, overflow: "auto", zIndex: 25 }}>
          <div className="track" style={{ marginBottom: 10 }}>Layers · {totalTracked.toLocaleString("en")} tracked</div>
          {LAYERS.map((l) => {
            const st = layers[l.id]; const on = !!enabled[l.id];
            return (
              <div key={l.id} onClick={() => !l.needsKey && setEnabled((s) => ({ ...s, [l.id]: !s[l.id] }))}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line)", cursor: l.needsKey ? "default" : "pointer", opacity: l.needsKey ? 0.5 : 1 }}>
                <span style={{ color: l.color, fontSize: 13, width: 16, textAlign: "center" }}>{l.glyph}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{l.name}</div>
                  <div style={{ fontSize: 9, color: "var(--dim2)" }}>{l.desc}</div>
                </div>
                {l.needsKey ? <span style={{ fontSize: 8, color: "var(--orange)", border: "1px solid var(--line-str)", padding: "2px 5px", borderRadius: 5 }}>KEY</span> : (
                  <>
                    <span className="tabular" style={{ fontSize: 10, color: "var(--dim)" }}>{st?.count ? st.count.toLocaleString("en") : "—"}</span>
                    <span style={{ width: 28, height: 16, borderRadius: 8, background: on ? "var(--gold)" : "#22252e", position: "relative", flex: "none", transition: ".18s" }}>
                      <span style={{ position: "absolute", top: 2, left: on ? 14 : 2, width: 12, height: 12, borderRadius: "50%", background: on ? "#0a0b10" : "#666", transition: ".18s" }} />
                    </span>
                  </>
                )}
              </div>
            );
          })}
          <div className="track" style={{ margin: "14px 0 6px" }}>Satellite density</div>
          <input type="range" min={200} max={4000} step={200} value={satCap} onChange={(e) => setSatCap(+e.target.value)} style={{ width: "100%", accentColor: "var(--gold)" }} />
          <div style={{ fontSize: 10, color: "var(--dim2)", marginTop: 4 }}>{satCap.toLocaleString("en")} objects propagated</div>
        </div>
      )}

      {/* ===== OSINT panel ===== */}
      {osintOpen && <OsintPanel isMobile={isMobile} onClose={() => setOsintOpen(false)} />}

      {/* ===== Right entity dossier ===== */}
      {selected && (
        <div className="glass" style={{ position: "fixed", right: 10, top: 62, width: isMobile ? "calc(100vw - 20px)" : 300,
          left: isMobile ? 10 : undefined, borderRadius: 12, padding: 15, zIndex: 27, maxHeight: "calc(100vh - 150px)", overflow: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="track" style={{ color: selected.color }}>{selected.layer}</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginTop: 3, lineHeight: 1.1 }}>{selected.label}</div>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: 0, color: "var(--dim)", fontSize: 20 }}>×</button>
          </div>
          {acPhoto && (
            <a href={acPhoto.link || "#"} target="_blank" rel="noopener noreferrer" style={{ display: "block", margin: "10px 0 4px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={acPhoto.photo} alt={selected.label} style={{ width: "100%", borderRadius: 8, border: "1px solid var(--line)", display: "block" }} />
              <div style={{ fontSize: 9, color: "var(--dim2)", marginTop: 3 }}>© {acPhoto.credit} · {acPhoto.source}</div>
            </a>
          )}
          <div style={{ margin: "12px 0", height: 1, background: "var(--line)" }} />
          {Object.entries(selected.props).map(([k, v]) => {
            const val = String(v);
            const isUrl = /^https?:\/\//.test(val);
            const isImg = isUrl && (k.includes("Snapshot") || /imgproxy|\.jpe?g($|\?)/.test(val));
            const isEmbed = isUrl && k.includes("Live feed") && /windy\.com|\/embed/.test(val);
            if (isEmbed) return (
              <div key={k} style={{ margin: "8px 0" }}>
                <div className="track" style={{ marginBottom: 6 }}>Live feed</div>
                <div style={{ position: "relative", width: "100%", paddingBottom: "56%", borderRadius: 8, overflow: "hidden", border: "1px solid var(--line)" }}>
                  <iframe src={val} title={selected.label} allow="autoplay; fullscreen" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
                </div>
              </div>
            );
            if (isImg) return (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={k} href={val} target="_blank" rel="noopener noreferrer" style={{ display: "block", margin: "8px 0" }}>
                <img src={val} alt={selected.label} style={{ width: "100%", borderRadius: 8, border: "1px solid var(--line)", display: "block" }} />
              </a>
            );
            return (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--line)", fontSize: 12 }}>
                <span style={{ color: "var(--dim)", flex: "none" }}>{k}</span>
                {isUrl ? <a href={val} target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold-hi)", fontWeight: 600, textAlign: "right", textDecoration: "none" }}>Open ↗</a>
                  : <b className="tabular" style={{ fontWeight: 600, textAlign: "right", maxWidth: 175 }}>{val}</b>}
              </div>
            );
          })}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 10.5, color: "var(--dim2)" }}>
            <span className="mono">{selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}</span>
            <span className="mono">ALT {Math.round(selected.altKm)} km</span>
          </div>
        </div>
      )}

      {/* ===== Bottom-left view controls + cursor readout ===== */}
      <div style={{ position: "fixed", left: 62, bottom: 40, zIndex: 24, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <div className="glass" style={{ borderRadius: 8, padding: 3, display: "flex", gap: 2 }}>
            <button onClick={() => setProjection("globe")} style={segBtn(projection === "globe")}>◍ 3D</button>
            <button onClick={() => setProjection("flat")} style={segBtn(projection === "flat")}>▦ 2D</button>
          </div>
          <div className="glass" style={{ borderRadius: 8, padding: 3, display: "flex", gap: 2 }}>
            <button onClick={() => setImagery("dark")} style={segBtn(imagery === "dark")}>◐ MAP</button>
            <button onClick={() => setImagery("satellite")} style={segBtn(imagery === "satellite")}>◉ SAT</button>
            <button onClick={() => setImagery("streets")} style={segBtn(imagery === "streets")}>▤ ST</button>
          </div>
          <button onClick={() => setTracks((t) => !t)} className="glass" style={{ ...segBtn(tracks), borderRadius: 8, padding: "7px 10px" }}>✈ Tracks</button>
        </div>
        {!isMobile && (
          <div className="mono" style={{ fontSize: 10, color: "var(--gold)", letterSpacing: ".06em", opacity: 0.85 }}>
            CURSOR {cursor.lat.toFixed(4)}, {cursor.lng.toFixed(4)} · ZOOM {cursor.zoom.toFixed(1)}
            {place && <span style={{ color: "var(--dim)" }}> · YOU {place}</span>}
          </div>
        )}
      </div>

      {/* ===== Bottom ticker ===== */}
      <div className="ticker-wrap glass" style={{ position: "fixed", left: 0, right: 0, bottom: 0, height: 30, zIndex: 23,
        display: "flex", alignItems: "center", overflow: "hidden", borderLeft: 0, borderRight: 0, borderBottom: 0 }}>
        <span className="hud" style={{ flex: "none", padding: "0 12px", fontSize: 10, letterSpacing: ".2em", color: "var(--green)", borderRight: "1px solid var(--line)" }}>● LIVE</span>
        <div style={{ flex: 1, overflow: "hidden", whiteSpace: "nowrap", position: "relative" }}>
          <div className="ticker-track">
            {[...tickerItems, ...tickerItems].map((it, i) => (
              <span key={i} className="mono" style={{ padding: "0 20px", fontSize: 11, color: "var(--dim)" }}>
                <span style={{ color: it.c }}>◆</span> {it.t}
              </span>
            ))}
            {tickerItems.length === 0 && <span className="mono" style={{ padding: "0 20px", fontSize: 11, color: "var(--dim2)" }}>initializing live feeds…</span>}
          </div>
        </div>
      </div>

      {/* ===== System feed (desktop, hidden when a panel is up) ===== */}
      {!isMobile && !selected && !osintOpen && (
        <div className="glass" style={{ position: "fixed", right: 10, bottom: 78, width: 280, borderRadius: 10, padding: "9px 11px", zIndex: 14 }}>
          <div className="track" style={{ marginBottom: 5 }}>System feed</div>
          {log.length === 0 && <div style={{ fontSize: 11, color: "var(--dim2)" }} className="mono">initializing…</div>}
          {log.map((l, i) => (
            <div key={i} className="mono" style={{ fontSize: 10, color: i === 0 ? "var(--green)" : "var(--dim)", padding: "1px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

type Arc = { startLat: number; startLng: number; endLat: number; endLng: number; color: string[] };

function EyeLogo() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-label="ARGOS">
      <path d="M2 16 C8 8 24 8 30 16 C24 24 8 24 2 16 Z" stroke="var(--gold)" strokeWidth="1.6" fill="rgba(212,175,55,.06)" />
      <circle cx="16" cy="16" r="5" stroke="var(--gold)" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="2" fill="var(--gold)" />
      <path d="M16 21 L16 27 M16 27 L12 30" stroke="var(--gold)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ZuluClock() {
  const [t, setT] = useState("--:--:--");
  useEffect(() => {
    const tick = () => setT(new Date().toISOString().slice(11, 19));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <b className="tabular" style={{ color: "var(--gold-hi)" }}>{t}Z</b>;
}

// ===== OSINT toolkit panel =====
type OsintTab = "ip" | "dns" | "whois" | "ssl";
function OsintPanel({ isMobile, onClose }: { isMobile: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<OsintTab>("ip");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [err, setErr] = useState("");

  const run = async () => {
    const q = input.trim();
    if (!q) return;
    setBusy(true); setErr(""); setResult(null);
    const param = tab === "ip" ? "ip" : "domain";
    try {
      const r = await fetch(`/api/osint/${tab}?${param}=${encodeURIComponent(q)}`);
      const j = await r.json();
      if (!j.ok) setErr(j.error || "no result");
      else setResult(j.data || j.records);
    } catch { setErr("request failed"); }
    setBusy(false);
  };

  return (
    <div className="glass" style={{ position: "fixed", right: 10, top: 62, width: isMobile ? "calc(100vw - 20px)" : 320,
      left: isMobile ? 10 : undefined, borderRadius: 12, padding: 14, zIndex: 29, maxHeight: "calc(100vh - 120px)", overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className="track" style={{ color: "var(--gold)" }}>◎ OSINT Toolkit</div>
        <button onClick={onClose} style={{ background: "none", border: 0, color: "var(--dim)", fontSize: 20 }}>×</button>
      </div>
      <div style={{ display: "flex", gap: 2, marginBottom: 8 }}>
        {(["ip", "dns", "whois", "ssl"] as OsintTab[]).map((t) => (
          <button key={t} onClick={() => { setTab(t); setResult(null); setErr(""); }} style={segBtn(tab === t)}>{t.toUpperCase()}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder={tab === "ip" ? "8.8.8.8" : "example.com"}
          style={{ flex: 1, background: "rgba(255,255,255,.04)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--txt)", outline: "none", fontSize: 12, padding: "8px 10px" }} />
        <button onClick={run} style={{ ...segBtn(true), padding: "8px 12px" }}>{busy ? "…" : "Run"}</button>
      </div>
      {err && <div className="mono" style={{ fontSize: 11, color: "var(--red)" }}>✕ {err}</div>}
      {result != null && (
        <pre className="mono" style={{ fontSize: 10.5, color: "var(--txt)", whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, lineHeight: 1.5 }}>
          {renderOsint(tab, result)}
        </pre>
      )}
      {!result && !err && !busy && (
        <div style={{ fontSize: 10.5, color: "var(--dim2)", lineHeight: 1.5 }}>
          Infrastructure recon over public sources: IP geolocation & ASN, DNS records, RDAP whois, TLS certificate transparency. Domains / IPs only.
        </div>
      )}
    </div>
  );
}

function renderOsint(tab: OsintTab, data: unknown): string {
  try {
    if (tab === "dns") {
      const rec = data as Record<string, string[]>;
      return Object.entries(rec).map(([t, v]) => `${t.padEnd(6)} ${v.join("\n      ")}`).join("\n");
    }
    if (tab === "ssl") {
      const d = data as { total: number; subdomains: string[]; recent: { issuer: string; name: string; from: string; to: string }[] };
      return `certs: ${d.total}\n\nsubdomains (${d.subdomains.length}):\n${d.subdomains.join("\n")}`;
    }
    const d = data as Record<string, unknown>;
    return Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).join("\n");
  } catch { return JSON.stringify(data, null, 2); }
}

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 820px)");
    const on = () => setM(mq.matches);
    on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return m;
}

const rowStyle: React.CSSProperties = { padding: "8px 12px", fontSize: 12, cursor: "pointer", borderBottom: "1px solid var(--line)", display: "flex", gap: 8, alignItems: "center" };
const hoverOn = (e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.background = "rgba(212,175,55,.15)");
const hoverOff = (e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.background = "transparent");

const railBtn = (on: boolean): React.CSSProperties => ({
  width: 32, height: 32, borderRadius: 7, border: "1px solid " + (on ? "var(--gold)" : "var(--line)"),
  background: on ? "var(--gold)" : "transparent", color: on ? "#0a0b10" : "var(--dim)", fontSize: 14, fontWeight: on ? 700 : 400, flex: "none",
});
const segBtn = (on: boolean): React.CSSProperties => ({
  border: 0, background: on ? "var(--gold)" : "transparent", color: on ? "#0a0b10" : "var(--dim)",
  fontSize: 11, padding: "7px 10px", borderRadius: 6, letterSpacing: ".02em", fontWeight: on ? 700 : 400,
});
const pill = (on: boolean): React.CSSProperties => ({
  border: "1px solid " + (on ? "var(--gold)" : "var(--line-str)"), background: on ? "var(--gold)" : "transparent",
  color: on ? "#0a0b10" : "var(--gold)", fontSize: 10.5, padding: "6px 12px", borderRadius: 20, letterSpacing: ".08em", fontWeight: 600,
});
