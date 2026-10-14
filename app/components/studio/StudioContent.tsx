"use client";

import { useState } from "react";
import StudioUploadWizard from "./StudioUploadWizard";
import StudioVideoEditor from "./StudioVideoEditor";
import StudioVideoList from "./StudioVideoList";

export type ContentView = { kind: "list" } | { kind: "upload" } | { kind: "edit"; id: string };

/** Studio -> Content: the channel's videos, the upload wizard and the video editor. */
export default function StudioContent({ initialView }: { initialView?: ContentView }) {
  const [view, setView] = useState<ContentView>(initialView ?? { kind: "list" });
  if (view.kind === "upload") {
    return <StudioUploadWizard onCancel={() => setView({ kind: "list" })} onFinished={(id) => setView({ kind: "edit", id })} />;
  }
  if (view.kind === "edit") {
    return <StudioVideoEditor id={view.id} onBack={() => setView({ kind: "list" })} />;
  }
  return <StudioVideoList onUpload={() => setView({ kind: "upload" })} onEdit={(id) => setView({ kind: "edit", id })} />;
}
