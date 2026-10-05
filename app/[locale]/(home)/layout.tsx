import { gateFont } from "@/app/fonts/gate-font";

/**
 * Home route group: provides the entry gate's font (`--font-gate`) to both the streaming
 * fallback (`loading.tsx`) and the page, and keeps its preload off every other route.
 */
export default function HomeGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={gateFont.variable} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
