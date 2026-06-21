import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('admin video canonical edit flow source contract', () => {
  it('links the video detail page to the canonical edit route instead of the legacy list edit query', () => {
    const source = readFileSync('app/admin/videos/[id]/page.tsx', 'utf8');

    expect(source).toContain('href={`/admin/videos/${video.id}/edit`}');
    expect(source).toContain('Edytuj dane filmu');
    expect(source).toContain('Przejdź do edycji dostępu');
    expect(source).not.toContain('href={`/admin/videos?edit=${video.id}`}');
  });

  it('keeps status visible in edit mode without pretending that publication is a normal metadata save', () => {
    const source = readFileSync('app/admin/videos/components/VideoForm.tsx', 'utf8');

    expect(source).toContain('{isCreate ? "Docelowy stan po zapisie" : "Status"}');
    expect(source).toContain('<SelectItem value="ARCHIVED">Zarchiwizowany</SelectItem>');
    expect(source).toContain('Publikacja pozostaje osobną akcją w szczegółach filmu');
  });
});
