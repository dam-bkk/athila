import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Client-side config. The Cesium Ion token is meant for browser use (and is
// domain-restrictable in Ion), so serving it to the client is fine. Kept in
// server env so it can change without a rebuild.
export function GET() {
  return NextResponse.json({
    cesiumToken: process.env.CESIUM_TOKEN || null,
  });
}
