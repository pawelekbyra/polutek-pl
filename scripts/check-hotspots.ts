import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";

type FileKind = "source" | "client-component" | "route";

type HotspotException = {
  maxLines: number;
  reason: string;
};

const repoRoot = process.cwd();
const sourceRoots = ["app", "lib", "middleware.ts"];
const sourceExtensions = new Set([".ts", ".tsx"]);
const ignoredDirectories = new Set([
  "node_modules",
  ".next",
  ".git",
  "coverage",
  "public",
]);

const budgets: Record<FileKind, number> = {
  source: 550,
  "client-component": 450,
  route: 350,
};

const knownUiHotspotReason =
  "Pre-existing large UI module tracked in #948; tolerated temporarily after Next 15 recovery but should be split before raising product launch readiness.";

const hotspotExceptions: Record<string, HotspotException> = {
  "app/components/icons/index.tsx": {
    maxLines: 1000,
    reason:
      "Central icon barrel/component registry; tolerated as pre-existing generated-style UI asset debt after Next 15 recovery, but block further unbounded growth.",
  },
  "app/admin/users/[userId]/page.tsx": {
    maxLines: 500,
    reason: knownUiHotspotReason,
  },
  "app/admin/videos/page.tsx": {
    maxLines: 500,
    reason: knownUiHotspotReason,
  },
  "app/admin/videos/[id]/page.tsx": {
    maxLines: 500,
    reason: knownUiHotspotReason,
  },
  "app/katalog/katalog-demos.tsx": {
    maxLines: 600,
    reason: "Experimental catalog demo library; contains many small inline UI components for style preview.",
  },
  "app/styler/StylerClient.tsx": {
    maxLines: 550,
    reason: "Style demonstrator with 5 inline style columns (Złoto/Ink/Neon/Akwarela/Brutalist) + shared RoughBox helpers; tracked for extraction before launch certification.",
  },
  "app/eksperyment2/ExperimentTwoSkin.tsx": {
    maxLines: 720,
    reason: "Experimental UI skin with dense inline CSS-in-JS styles; tracked as style-lab debt, tolerated until a final skin direction is chosen.",
  },
  "app/components/experiments/Layout8Watercolor.tsx": {
    maxLines: 460,
    reason: "Experimental homepage layout showcase; dense inline CSS-in-JS styles for SVG watercolor effects. Style-lab only, not in production flows.",
  },
  "app/components/experiments/Layout12Blueprint.tsx": {
    maxLines: 490,
    reason: "Experimental homepage layout showcase; dense inline CSS-in-JS styles for blueprint/technical drawing effects. Style-lab only, not in production flows.",
  },
  "app/components/experiments/Layout13Risograph.tsx": {
    maxLines: 480,
    reason: "Experimental homepage layout showcase; dense inline CSS-in-JS styles for risograph print simulation. Style-lab only, not in production flows.",
  },
  "app/components/experiments/Layout14InkCalligraphy.tsx": {
    maxLines: 470,
    reason: "Experimental homepage layout showcase; dense inline CSS-in-JS styles for calligraphy/ink effects. Style-lab only, not in production flows.",
  },
  "app/components/experiments/Layout15WiredElements.tsx": {
    maxLines: 540,
    reason: "Experimental homepage layout showcase; dense inline CSS-in-JS styles for wired-elements web component demo. Style-lab only, not in production flows.",
  },
  "app/eksperyment7/ExperimentSevenSkin.tsx": {
    maxLines: 480,
    reason: "Experimental UI skin with dense inline CSS-in-JS styles; tracked as style-lab debt, tolerated until a final skin direction is chosen.",
  },
  "app/admin/emails/EmailTemplateEditor.tsx": {
    maxLines: 500,
    reason: knownUiHotspotReason,
  },
  "app/admin/emails/components/BroadcastWizard.tsx": {
    maxLines: 500,
    reason: knownUiHotspotReason,
  },
  "app/components/Hero.tsx": {
    maxLines: 500,
    reason: knownUiHotspotReason,
  },
  "app/components/PremiumWrapper.tsx": {
    maxLines: 500,
    reason: knownUiHotspotReason,
  },
  "app/components/VideoPlayer.tsx": {
    maxLines: 650,
    reason:
      "Pre-existing large client player module after player-control repairs; tolerated temporarily so hotspot CI remains visible, but must be split in the dedicated player refactor before launch certification.",
  },
  "app/components/VideoPlaylist.tsx": {
    maxLines: 500,
    reason: knownUiHotspotReason,
  },
  "app/components/comments/EmbeddedComments.tsx": {
    maxLines: 600,
    reason: knownUiHotspotReason,
  },
  "app/components/channel/SidebarPlaylist.tsx": {
    maxLines: 470,
    reason: "Expanded with patron countdown timer and Frame-based button during style refinement; tracked for extraction of PatronBox into a standalone component.",
  },
  "app/components/comments/components/CommentItem.tsx": {
    maxLines: 500,
    reason: knownUiHotspotReason,
  },
  "lib/services/playback/playback.service.ts": {
    maxLines: 700,
    reason:
      "Added Mux (signed JWT HLS) and Vimeo (embed) provider resolvers in the multi-source video feature (#1204); tracked for extraction into provider-specific adapter modules before launch certification.",
  },
};

type Violation = {
  file: string;
  lines: number;
  limit: number;
  kind: FileKind;
  reason?: string;
};

function isSourceFile(filePath: string) {
  return sourceExtensions.has(path.extname(filePath));
}

function collectFiles(entry: string): string[] {
  const absolutePath = path.join(repoRoot, entry);
  const stat = statSync(absolutePath);

  if (stat.isFile()) {
    return isSourceFile(absolutePath) ? [absolutePath] : [];
  }

  const files: string[] = [];
  for (const child of readdirSync(absolutePath)) {
    if (ignoredDirectories.has(child)) continue;

    const childPath = path.join(absolutePath, child);
    const childStat = statSync(childPath);
    if (childStat.isDirectory()) {
      files.push(...collectFiles(path.relative(repoRoot, childPath)));
    } else if (isSourceFile(childPath)) {
      files.push(childPath);
    }
  }

  return files;
}

function classifyFile(relativeFile: string, source: string): FileKind {
  if (relativeFile.endsWith("/route.ts")) return "route";
  if (relativeFile.endsWith(".tsx") && source.startsWith('"use client"'))
    return "client-component";
  return "source";
}

const violations: Violation[] = [];

for (const root of sourceRoots) {
  for (const file of collectFiles(root)) {
    const relativeFile = path.relative(repoRoot, file);
    const source = readFileSync(file, "utf8");
    const lines = source.split("\n").length;
    const kind = classifyFile(relativeFile, source);
    const exception = hotspotExceptions[relativeFile];
    const limit = exception?.maxLines ?? budgets[kind];

    if (lines > limit) {
      violations.push({
        file: relativeFile,
        lines,
        limit,
        kind,
        reason: exception?.reason,
      });
    }
  }
}

if (violations.length > 0) {
  console.error(
    "Hotspot guard failed: file size budget exceeded. Split the module or add a documented temporary exception.",
  );
  for (const violation of violations) {
    console.error(
      `- ${violation.file}: ${violation.lines} lines > ${violation.limit} (${violation.kind})${
        violation.reason ? ` — ${violation.reason}` : ""
      }`,
    );
  }
  process.exit(1);
}

console.log(
  "Hotspot guard passed: source files stay within LOC budgets or documented temporary exceptions.",
);
