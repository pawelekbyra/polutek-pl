/**
 * Film translations (docs/architecture/translations-concept.md, admin-phase2-content.md section 6):
 * languages, address generator, public rules for machine drafts, and the panel's use cases.
 */
export * from "./domain/languages";
export * from "./domain/slug";
export * from "./domain/public-meta";
export * from "./application/translations";
export * from "./domain/draft-provider";
export * from "./application/generate-drafts";
export { createWorkersAiProvider } from "./infrastructure/workers-ai-provider";
