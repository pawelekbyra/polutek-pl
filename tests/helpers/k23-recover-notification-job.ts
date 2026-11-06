import { prisma } from "@/lib/prisma";
import { runNewVideoFanOutJobs } from "@/lib/modules/notifications/application/new-video-fan-out.use-case";

async function main() {
  try {
    const result = await runNewVideoFanOutJobs({ maxJobs: 1 });
    process.stdout.write(JSON.stringify(result));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch(() => {
  process.exitCode = 1;
});
