import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeSync } from "@/components/theme/theme-sync";
import { THEME_INIT_SCRIPT } from "@/components/theme/theme";

export const metadata: Metadata = {
  title: { default: "Fashinza — Garment manufacturing for fashion brands", template: "%s | Fashinza" },
  description:
    "Fashinza connects fashion brands, clothing startups and designers with garment manufacturers: share tech packs, develop samples, compare quotations, and follow apparel production and quality inspection in one place.",
};

export const viewport: Viewport = {
  // Browser chrome matches the page canvas: warm ivory (light) and charcoal (dark).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8F6F1" },
    { media: "(prefers-color-scheme: dark)", color: "#161616" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-theme is set by the inline script before first paint (and re-applied by ThemeSync), so the
    // server markup cannot match it: suppressHydrationWarning covers this element's attributes only.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <ThemeSync />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
