import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const embedded = () => readFileSync('app/components/comments/EmbeddedComments.tsx', 'utf8');
const hook = () => readFileSync('app/components/comments/hooks/useComments.ts', 'utf8');
const channelHome = () => readFileSync('app/components/ChannelHome.tsx', 'utf8');
const page = () => readFileSync('app/components/home/HomeExperience.tsx', 'utf8');
const composer = () => readFileSync('app/components/comments/components/CommentComposer.tsx', 'utf8');

describe('comments access hardening', () => {
  it('EmbeddedComments: canComment comes only from the server viewer state', () => {
    const source = embedded();
    expect(source).toContain('canComment={viewer?.canComment ?? false}');
    const canCommentLine = source.split('\n').find(l => l.includes('canComment={'));
    expect(canCommentLine).not.toContain('isPatron');
    expect(canCommentLine).not.toContain('userProfile');
  });

  it('no public supporter distinction: no patron decoration flag or avatar ring anywhere in the comments shell', () => {
    for (const source of [embedded(), hook(), channelHome(), page(), composer()]) {
      expect(source).not.toContain('isPatronDecorative');
      expect(source).not.toContain('chan-patron-ring');
    }
    expect(hook()).toContain('badges: [],');
  });

  it('EmbeddedComments: does NOT use publicMetadata.isPatron for canComment', () => {
    const source = embedded();
    // find the part where canComment is passed to CommentComposer
    const composerIndex = source.indexOf('<CommentComposer');
    const composerBlock = source.substring(composerIndex, source.indexOf('/>', composerIndex));

    expect(composerBlock).toContain('canComment={viewer?.canComment ?? false}');
    expect(composerBlock).not.toContain('metadata.isPatron');
  });
});
