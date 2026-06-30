"use client";

import React from "react";
import ChannelHome from "../components/ChannelHome";
import { PublicVideoDTO } from "../types/video";
import { V2Provider } from "./V2Context";

interface V2HomeProps {
  mainVideo: PublicVideoDTO | null;
  allVideos: PublicVideoDTO[];
  currentVideoId?: string;
  userProfile?: {
    id: string;
    email: string;
    imageUrl?: string | null;
    totalPaid: number;
    initialInteraction?: { liked: boolean; disliked: boolean };
    initialIsSubscribed?: boolean;
    isPatronDecorative?: boolean;
    role?: string;
  } | null;
}

export default function V2Home(props: V2HomeProps) {
  return (
    <V2Provider>
      <div
        style={
          {
            "--font-najs": "var(--font-patrick, 'Patrick Hand', cursive)",
          } as React.CSSProperties
        }
      >
        <ChannelHome {...props} />
      </div>
    </V2Provider>
  );
}
