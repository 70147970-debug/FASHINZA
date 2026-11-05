import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const API_TARGET = process.env.VITE_API_TARGET ?? "http://localhost:4000";

/**
 * Dev: Vite on :5173 serves the client and proxies /api to Express on :4000. `changeOrigin` stays false so the
 * Host header remains localhost:5173 and matches the browser's Origin (the server rejects cross-site mutations,
 * docs/mern/api.md §1.6). Photos come from the root public/ folder (public/images), exactly as the Next app
 * served them; Express serves the same folder in production.
 */
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig(({ mode }) => {
  // NEXT_PUBLIC_CONTACT_EMAIL (root .env or the environment) is inlined at build time, as Next inlined it;
  // @fashinza/shared/constants.js falls back to its default when it is not set.
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? loadEnv(mode, REPO_ROOT, "NEXT_PUBLIC_").NEXT_PUBLIC_CONTACT_EMAIL;
  return {
    define: contactEmail ? { "process.env.NEXT_PUBLIC_CONTACT_EMAIL": JSON.stringify(contactEmail) } : {},
    plugins: [react(), tailwindcss()],
    publicDir: fileURLToPath(new URL("../public", import.meta.url)),
    // Tailwind runs as a Vite plugin; an inline (empty) PostCSS config stops Vite from picking up the Next app's
    // postcss.config.mjs in the repository root.
    css: { postcss: { plugins: [] } },
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": { target: API_TARGET, changeOrigin: false, xfwd: true },
      },
    },
    preview: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": { target: API_TARGET, changeOrigin: false, xfwd: true },
      },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      // The shared entry chunk (React, React Router, Radix, sonner, the shell) is ~510 kB before gzip (~160 kB
      // gzipped); pages are split into their own chunks.
      chunkSizeWarningLimit: 600,
    },
  };
});
