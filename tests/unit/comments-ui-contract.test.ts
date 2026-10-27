import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const composer = () => readFileSync('app/components/comments/components/CommentComposer.tsx', 'utf8');
const embedded = () => readFileSync('app/components/comments/EmbeddedComments.tsx', 'utf8');
const hook = () => readFileSync('app/components/comments/hooks/useComments.ts', 'utf8');
const item = () => readFileSync('app/components/comments/components/CommentItem.tsx', 'utf8');
const reactions = () => readFileSync('app/components/comments/components/CommentReactions.tsx', 'utf8');
const motion = () => readFileSync('app/components/comments/components/comment-motion.tsx', 'utf8');

describe('comments UI production contract', () => {
  it('uses a semantic accessible form with typed buttons and inline errors', () => {
    const source = composer();

    expect(source).toContain('<form className="relative" onSubmit={handleSubmit} noValidate>');
    expect(source).toContain('type="submit"');
    expect(source).toContain('type="button"');
    expect(source).toContain('aria-invalid={Boolean(errorMessage || isTooLong)}');
    expect(source).toContain('aria-describedby=');
    expect(source).toContain('role="alert"');
    expect(source).toContain('e.currentTarget.form?.requestSubmit()');
  });

  it('keeps the guest sign-in CTA and never asks for a tip to comment', () => {
    const source = composer();

    expect(source).toContain('openAuthModal("sign-in")');
    // Commenting only needs sign-in (CLAUDE.md §4.4) — no tip/patron gate.
    expect(source).not.toContain('isPatronGated');
    expect(source).not.toContain('Zostaw napiwek, aby komentować');
    expect(source).not.toContain('Leave a tip to comment');
    expect(source).not.toContain('<span className="text-[14px] font-bold text-blue-600 underline underline-offset-4 hover:opacity-80 transition-all text-center">');
  });

  it('does not clear the textarea on failed submit and exposes the post error to the composer', () => {
    const source = embedded();

    expect(source).toContain('onError: (error) =>');
    // The error shown is a translated text chosen by the API error code (audit S05), never the server's raw message.
    expect(source).toContain('setComposerError(');
    expect(source).toContain('commentErrorText(error, tx,');
    expect(source).toContain('onSuccess: () =>');
    expect(source).toContain('setNewComment("");');
    expect(source).toContain('errorMessage={composerError}');
  });

  it('posts the supported text contract and does not expose image attachment UI', () => {
    const composerSource = composer();
    const hookSource = hook();

    expect(composerSource).not.toContain('/api/comments/image-upload');
    expect(composerSource).not.toContain('type="file"');
    expect(composerSource).not.toContain('accept="image/');
    expect(composerSource).not.toContain('uploadedImage');
    expect(hookSource).toMatch(
      /body: JSON\.stringify\(\{\s*text,\s*parentId,\s*\}\)/,
    );
  });

  it('keeps comment reactions accessible and permission-gated', () => {
    const source = item();

    expect(source).toContain('const reactionsDisabled = !userProfile || !canComment || isReactionPending;');
    expect(source).toContain('disabled={reactionsDisabled}');
    expect(reactions()).toContain('aria-pressed={isLiked}');
    expect(reactions()).toContain('aria-pressed={isDisliked}');
    // Reaction buttons are compact, repeated icon controls (h-8/32px, matching this file's
    // other dense-list controls like the "..." menu trigger and reply button) rather than
    // the 44px min-h-11 target used for one-off primary CTAs — still comfortably above
    // WCAG 2.2 AA's 24px Target Size (Minimum) criterion (docs/strategy/PRODUCT-STANDARD.md
    // X6.4 targets WCAG 2.2 AA generally; the 24px figure is the spec's own number, not
    // stated verbatim in that doc). Assert the visible focus indicator instead.
    expect(reactions()).toContain('focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)]');
    expect(source).toContain('locale: dateFnsLocale(language)');
  });

  it('renders static comment motion equivalents for reduced-motion users', () => {
    const source = motion();

    expect(source).toContain('useReducedMotion');
    expect(source.match(/if \(shouldReduceMotion\)/g)).toHaveLength(3);
  });
});
