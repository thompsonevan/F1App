import { ImageResponse } from "next/og";
import { AppIconMark } from "@/lib/app-icon";

// A plain Route Handler (not the special icon.tsx/apple-icon.tsx
// convention) generating the 192x192 icon manifest.ts references — the
// size Chrome's install/"Add to Home Screen" heuristic looks for
// (alongside 512x512 below), which icon.tsx (32x32) and apple-icon.tsx
// (180x180) don't cover.
const SIZE = 192;

export async function GET() {
  return new ImageResponse(<AppIconMark size={SIZE} />, { width: SIZE, height: SIZE });
}
