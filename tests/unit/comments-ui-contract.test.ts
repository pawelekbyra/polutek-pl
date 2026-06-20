import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const composer = () => readFileSync('app/components/comments/components/CommentComposer.tsx', 'utf8');
const embedded = () => readFileSync('app/components/comments/EmbeddedComments.tsx', 'utf8');
const hook = () => readFileSync('app/components/comments/hooks/useComments.ts', 'utf8');

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

  it('keeps guest sign-in CTA and provides a real Patron CTA link for non-patrons', () => {
    const source = composer();

    expect(source).toContain('<SignInButton mode="modal">');
    expect(source).toContain('isPatronGated && userProfile');
    expect(source).toContain('href="#donations"');
    expect(source).toContain('Zostań Patronem, żeby komentować');
    expect(source).toContain('Become a Patron to comment');
    expect(source).not.toContain('<span className="text-[14px] font-bold text-blue-600 underline underline-offset-4 hover:opacity-80 transition-all text-center">');
  });

  it('does not clear the textarea on failed submit and exposes the post error to the composer', () => {
    const source = embedded();

    expect(source).toContain('onError: (error) =>');
    expect(source).toContain('setComposerError(message);');
    expect(source).toContain('onSuccess: () =>');
    expect(source).toContain('setNewComment("");');
    expect(source).toContain('errorMessage={composerError}');
  });

  it('optimistically inserts top-level newest comments and reply previews with exact rollback data', () => {
    const source = hook();

    expect(source).toContain('createOptimisticComment');
    expect(source).toContain('String(queryKey[2]) === "newest"');
    expect(source).toContain('comments: [optimisticComment, ...pages[0].comments]');
    expect(source).toContain('repliesPreview: [...(c.repliesPreview ?? []), optimisticComment]');
    expect(source).toContain('return { previousData: queries, optimisticId: optimisticComment.id };');
    expect(source).toContain('queryClient.setQueryData(queryKey, data);');
  });

  it('keeps image comments as backend-compatible only and does not advertise image UI', () => {
    const composerSource = composer();
    const hookSource = hook();

    expect(composerSource).not.toContain('imageUrl');
    expect(hookSource).not.toContain('imageUrl,');
  });
});
