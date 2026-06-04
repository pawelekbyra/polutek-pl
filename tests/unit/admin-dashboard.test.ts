import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('admin dashboard routing', () => {
  it('renders four admin section tiles with expected links', () => {
    const source = readFileSync(join(process.cwd(), 'app/admin/page.tsx'), 'utf8');

    for (const title of ['Maile', 'Filmy', 'Kanał', 'Użytkownicy']) {
      expect(source).toContain(`title: "${title}"`);
    }

    for (const href of ['/admin/emails', '/admin/videos', '/admin/channel', '/admin/users']) {
      expect(source).toContain(`href: "${href}"`);
    }
  });
});
