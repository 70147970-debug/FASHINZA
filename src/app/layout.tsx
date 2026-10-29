import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeSync } from "@/components/theme/theme-sync";
import { THEME_INIT_SCRIPT } from "@/components/theme/theme";

export const metadata: Metadata = {
  title: { default: "Fashinza — Apparel manufacturing, managed", template: "%s | Fashinza" },
  description:
    "Fashinza connects fashion brands with clothing manufacturers: submit requirements, compare quotations, and track production and quality control in one place.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F1EA" },
    { media: "(prefers-color-scheme: dark)", color: "#151210" },
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
