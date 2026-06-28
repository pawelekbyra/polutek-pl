import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const SETTING_KEY = "default_video_thumbnail";

export async function GET() {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });

    if (!setting) {
      return NextResponse.json({ error: "No default thumbnail configured" }, { status: 404 });
    }

    const blob = await get(setting.value);
    if (!blob) {
      return NextResponse.json({ error: "Thumbnail not found in storage" }, { status: 404 });
    }

    const response = await fetch(blob.downloadUrl, { cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to retrieve thumbnail" }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
