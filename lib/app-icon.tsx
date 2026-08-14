import type { ReactElement } from "react";

/**
 * Shared visual for every generated app icon size (app/icon.tsx,
 * app/apple-icon.tsx, the manifest's larger PWA icons) — a red rounded
 * square with bold white "F1" text, matching the app's existing red accent
 * (the `bg-red-600` F1TV button, the red badges). Deliberately plain
 * CSS/text rather than an emoji glyph: ImageResponse (Satori) resolves
 * emoji via a remote Twemoji fetch, which would make icon generation
 * depend on outbound network access at request/build time for something as
 * basic as a favicon — this has no such dependency.
 */
export function AppIconMark({ size }: { size: number }): ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#dc2626",
        borderRadius: size * 0.2,
        color: "white",
        fontFamily: "Arial, Helvetica, sans-serif",
        fontWeight: 700,
        fontSize: size * 0.46,
        letterSpacing: -1,
      }}
    >
      F1
    </div>
  );
}
