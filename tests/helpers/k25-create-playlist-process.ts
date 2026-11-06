import { prisma } from "@/lib/prisma";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { createPlaylist } from "@/lib/modules/playlists/application/playlist-manage.use-cases";

async function main() {
  const channelId = process.env.K25_CHANNEL_ID;
  const userId = process.env.K25_USER_ID;
  const title = process.env.K25_TITLE;
  if (!channelId || !userId || !title) throw new Error("Missing K25 process fixture input");

  try {
    const result = await createPlaylist(createAppContext({
      actor: { type: "user", userId },
      prisma,
      channelId,
    }), { channelId, title });
    process.stdout.write(JSON.stringify(result.ok ? { ok: true, id: result.data.id } : {
      ok: false,
      code: result.error.code,
      statusCode: result.error.statusCode,
    }));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(JSON.stringify({ error: error instanceof Error ? error.name : "unknown" }));
  process.exitCode = 1;
});
