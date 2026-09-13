import { describe, it, expect } from 'vitest';
import { splitTitleForHighlight } from '@/lib/modules/campaign/secret-project-title';

describe('splitTitleForHighlight', () => {
  it('splits the current real title around "secret" and reports a match', () => {
    const result = splitTitleForHighlight('I raise money for my secret project', 'secret');

    expect(result).toEqual({
      before: 'I raise money for my',
      highlight: 'secret',
      after: 'project',
      matched: true,
    });
  });

  it('falls back to the whole title unstyled when the word is missing (drifted copy)', () => {
    const title = 'I raise money for my mystery project';
    const result = splitTitleForHighlight(title, 'secret');

    expect(result).toEqual({
      before: title,
      highlight: '',
      after: '',
      matched: false,
    });
  });

  it('does not match a bare substring without word boundaries', () => {
    // "secretly" contains "secret" as a substring but not as the standalone
    // " secret " word this helper looks for — must not partially match.
    const title = 'I am secretly funding a project';
    const result = splitTitleForHighlight(title, 'secret');

    expect(result.matched).toBe(false);
    expect(result.before).toBe(title);
  });
});
