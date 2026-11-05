import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
// Inter (variable) — imported by src/app/layout.tsx in the Next app; Playfair Display is imported by globals.css.
import "@fontsource-variable/inter";
import "./styles/globals.css";
import { createRouter } from "./router";

const router = createRouter();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
