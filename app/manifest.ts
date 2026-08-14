import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "F1 Dashboard",
    short_name: "F1 Dashboard",
    description: "Formula 1 race, driver, and standings data — current and historical.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#dc2626",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
      { src: "/pwa-icon-192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon-512", sizes: "512x512", type: "image/png" },
    ],
  };
}
