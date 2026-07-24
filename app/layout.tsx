import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARGOS — Open-Source Intelligence Platform",
  description:
    "Live geospatial intelligence over open public feeds — aircraft, satellites, maritime, conflicts, fires, cyber threats and more on a 3D globe.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#05060a",
};

// System font stack (see globals.css) — no build-time font download, so the
// Docker build stays fast, offline-capable and reproducible.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
