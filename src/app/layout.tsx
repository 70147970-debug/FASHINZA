import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Fashinza — Apparel manufacturing, managed", template: "%s | Fashinza" },
  description:
    "Fashinza connects fashion brands with clothing manufacturers: submit requirements, compare quotations, and track production and quality control in one place.",
};

export const viewport: Viewport = { themeColor: "#14263D" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
