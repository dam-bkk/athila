import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Real global cloud imagery — NASA GIBS true-color composite (MODIS/VIIRS),
// served as an equirectangular JPEG we texture straight onto the globe.
// We proxy it so the browser gets a same-origin image (no CORS/WebGL issues)
// and we can pick the most recent day that actually has data.
function dayStr(offset: number): string {
  const d = new Date(Date.now() - offset * 86_400_000);
  return d.toISOString().slice(0, 10);
}

const LAYER = "MODIS_Terra_CorrectedReflectance_TrueColor";

function gibsUrl(date: string): string {
  const p = new URLSearchParams({
    SERVICE: "WMS",
    REQUEST: "GetMap",
    VERSION: "1.3.0",
    LAYERS: LAYER,
    CRS: "EPSG:4326",
    BBOX: "-90,-180,90,180",
    WIDTH: "2048",
    HEIGHT: "1024",
    FORMAT: "image/jpeg",
    TIME: date,
  });
  return "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?" + p.toString();
}

export async function GET() {
  // Try the last few UTC days until one returns a real image.
  for (const offset of [1, 2, 3, 0]) {
    const date = dayStr(offset);
    try {
      const r = await fetch(gibsUrl(date), { cache: "no-store" });
      if (!r.ok) continue;
      const buf = await r.arrayBuffer();
      if (buf.byteLength < 20_000) continue; // blank/failed tile
      return new NextResponse(buf, {
        headers: {
          "content-type": "image/jpeg",
          "cache-control": "public, max-age=3600",
          "x-gibs-date": date,
        },
      });
    } catch {
      /* try older day */
    }
  }
  return NextResponse.json({ ok: false, error: "no imagery" }, { status: 502 });
}
