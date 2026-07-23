import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ATHILA — Geospatial Console",
  description: "Live geospatial intelligence over open public feeds.",
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
