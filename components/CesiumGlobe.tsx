"use client";

// Deep-zoom 3D engine (Cesium) — real satellite imagery (token-free ArcGIS),
// GPU-batched points for thousands of live entities, click-to-select, fly-to.
// Rendered client-only via dynamic import in the parent.

import { useEffect, useRef } from "react";
import type { Entity, GlobeControl } from "@/lib/types";

// Must be set before Cesium loads its web workers.
if (typeof window !== "undefined") {
  (window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = "/cesium";
}

function hexToCesiumColor(Cesium: any, hex: string) {
  return Cesium.Color.fromCssColorString(hex);
}

export default function CesiumGlobe({
  entities,
  onSelect,
  apiRef,
}: {
  entities: Entity[];
  selected: Entity | null;
  onSelect: (e: Entity | null) => void;
  apiRef?: React.MutableRefObject<GlobeControl | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const pointsRef = useRef<any>(null);
  const CesiumRef = useRef<any>(null);
  const entitiesRef = useRef<Entity[]>(entities);
  entitiesRef.current = entities;

  // Init viewer once
  useEffect(() => {
    let destroyed = false;
    (async () => {
      const Cesium = await import("cesium");
      await import("cesium/Build/Cesium/Widgets/widgets.css");
      if (destroyed || !containerRef.current) return;
      CesiumRef.current = Cesium;

      const viewer = new Cesium.Viewer(containerRef.current, {
        baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false,
        timeline: false, animation: false, navigationHelpButton: false, fullscreenButton: false,
        infoBox: false, selectionIndicator: false, creditContainer: document.createElement("div"),
        baseLayer: new Cesium.ImageryLayer(
          new Cesium.UrlTemplateImageryProvider({
            url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            maximumLevel: 19,
          })
        ),
      });
      viewerRef.current = viewer;
      viewer.scene.globe.enableLighting = true;
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
      viewer.camera.flyHome(0);
      viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(10, 25, 22_000_000) });

      const points = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());
      pointsRef.current = points;
      rebuild();

      // Click to select
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((movement: any) => {
        const picked = viewer.scene.pick(movement.position);
        if (picked && picked.id && picked.id.uid) onSelect(picked.id as Entity);
        else onSelect(null);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      if (apiRef) {
        apiRef.current = {
          zoom: (f: number) => {
            const h = viewer.camera.positionCartographic.height;
            viewer.camera.zoomIn(h * (1 - f));
          },
          reset: () =>
            viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(10, 25, 22_000_000), duration: 1.2 }),
          flyTo: (e: Entity) =>
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(e.lng, e.lat, Math.max(4000, e.altKm * 1000 + 60000)),
              duration: 1.4,
            }),
          flyToPlace: (lat: number, lng: number) =>
            viewer.camera.flyTo({
              destination: Cesium.Cartesian3.fromDegrees(lng, lat, 14000),
              duration: 2.0,
            }),
        };
      }
    })();
    return () => {
      destroyed = true;
      try { viewerRef.current?.destroy(); } catch { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild point collection when entities change
  const rebuild = () => {
    const Cesium = CesiumRef.current;
    const points = pointsRef.current;
    if (!Cesium || !points) return;
    points.removeAll();
    for (const e of entitiesRef.current) {
      points.add({
        position: Cesium.Cartesian3.fromDegrees(e.lng, e.lat, e.altKm * 1000),
        color: hexToCesiumColor(Cesium, e.color),
        pixelSize: e.layer === "satellites" ? 3 : e.ring ? 7 : 5,
        outlineColor: Cesium.Color.BLACK.withAlpha(0.4),
        outlineWidth: 0.5,
        id: e,
        scaleByDistance: new Cesium.NearFarScalar(1.5e6, 2.2, 4.0e7, 0.5),
      });
    }
  };

  useEffect(() => {
    rebuild();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities]);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
