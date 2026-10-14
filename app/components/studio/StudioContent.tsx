"use client";

import { useState } from "react";
import StudioUploadWizard from "./StudioUploadWizard";
import StudioVideoEditor from "./StudioVideoEditor";
import StudioVideoList from "./StudioVideoList";
import type { StudioLimits } from "./studio-client";

export type ContentView = { kind: "list" } | { kind: "upload" } | { kind: "edit"; id: string };

/** Studio -> Content: the channel's videos, the upload wizard and the video editor. */
export default function StudioContent({ initialView, limits }: { initialView?: ContentView; limits?: StudioLimits | null }) {
  const [view, setView] = useState<ContentView>(initialView ?? { kind: "list" });
  if (view.kind === "upload") {
    return <StudioUploadWizard limits={limits ?? null} onCancel={() => setView({ kind: "list" })} onFinished={(id) => setView({ kind: "edit", id })} />;
  }
  if (view.kind === "edit") {
    return <StudioVideoEditor id={view.id} onBack={() => setView({ kind: "list" })} />;
  }
  return <StudioVideoList onUpload={() => setView({ kind: "upload" })} onEdit={(id) => setView({ kind: "edit", id })} />;
}
