import { ImageResponse } from "next/og";
import { AppIconMark } from "@/lib/app-icon";

// See app/pwa-icon-192/route.tsx — same reasoning, the other size Chrome's
// PWA installability check looks for.
const SIZE = 512;

export async function GET() {
  return new ImageResponse(<AppIconMark size={SIZE} />, { width: SIZE, height: SIZE });
}
