import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const embedded = () => readFileSync('app/components/comments/EmbeddedComments.tsx', 'utf8');
const hook = () => readFileSync('app/components/comments/hooks/useComments.ts', 'utf8');
const channelHome = () => readFileSync('app/components/ChannelHome.tsx', 'utf8');
const page = () => readFileSync('app/home-page.tsx', 'utf8');

describe('comments access hardening', () => {
  it('EmbeddedComments: derives canComment strictly from viewer state and isPatron is renamed to isPatronDecorative', () => {
    const source = embedded();

    // Renamed prop
    expect(source).toContain('isPatronDecorative?: boolean;');
    expect(source).not.toContain('isPatron?: boolean;');

    // Mapping from Clerk metadata
    expect(source).toContain('isPatronDecorative: booleanMetadata(metadata.isPatron)');

    // Defensive default for commenting
    expect(source).toContain('canComment={viewer?.canComment ?? false}');

    // logic check: isPatronDecorative must not influence canComment
    const canCommentLine = source.split('\n').find(l => l.includes('canComment={'));
    expect(canCommentLine).not.toContain('isPatron');
    expect(canCommentLine).not.toContain('userProfile');
  });

  it('useComments: optimistic UI uses isPatronDecorative badge truth', () => {
    const source = hook();
    expect(source).toContain('if (userProfile?.isPatronDecorative) badges.push({ type: "PATRON", label: "Patron" });');
    expect(source).not.toContain('if (userProfile?.isPatron) badges.push');
  });

  it('ChannelHome: uses renamed isPatronDecorative', () => {
    const source = channelHome();
    expect(source).toContain('isPatronDecorative?: boolean;');
    expect(source).toContain('const viewerIsPatron = userProfile?.role === \'ADMIN\' || userProfile?.isPatronDecorative === true;');
    expect(source).not.toContain('userProfile?.isPatron === true');
  });

  it('Root Page: maps DB truth to isPatronDecorative', () => {
    const source = page();
    expect(source).toContain('isPatronDecorative: userDb?.role === \'ADMIN\' || hasActivePatronGrant');
    expect(source).not.toContain('isPatron: userDb?.role === \'ADMIN\' || hasActivePatronGrant');
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
