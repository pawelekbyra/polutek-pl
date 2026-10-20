import { describe, it, expect } from 'vitest';
import {
  areChaptersEqual,
  chapterRows,
  chaptersPayload,
  commitTime,
  importFromDescriptions,
  newChapterRow,
  problemText,
  rowProblems,
  skippedReasonText,
  sortRows,
  type ChapterRow,
} from '@/app/components/studio/chapters-form';
import { isFormDirty, videoToForm, type EditorForm } from '@/app/components/studio/video-form';
import { createTx } from '@/lib/i18n/ui';

const row = (time: string, title = 'T', titleEn = ''): ChapterRow => ({ key: `k${time}${title}`, time, title, titleEn });
const tx = createTx('pl');
const txEn = createTx('en');

describe('chapter rows', () => {
  it('turns chapters into rows with a readable time and back into the payload', () => {
    const rows = chapterRows([
      { startSeconds: 0, title: 'Wstęp' },
      { startSeconds: 95, title: 'Temat', titleEn: 'Topic' },
      { startSeconds: 3723, title: 'Koniec' },
    ]);
    expect(rows.map((r) => [r.time, r.title, r.titleEn])).toEqual([
      ['0:00', 'Wstęp', ''],
      ['1:35', 'Temat', 'Topic'],
      ['1:02:03', 'Koniec', ''],
    ]);
    expect(new Set(rows.map((r) => r.key)).size).toBe(3);
    expect(chaptersPayload(rows)).toEqual([
      { startSeconds: 0, title: 'Wstęp' },
      { startSeconds: 95, title: 'Temat', titleEn: 'Topic' },
      { startSeconds: 3723, title: 'Koniec' },
    ]);
  });

  it('an empty list is the payload null (clears the chapters) and is valid', () => {
    expect(chaptersPayload([])).toBeNull();
    expect(rowProblems([])).toEqual([]);
  });

  it('a new row goes one minute after the last one, or at 0:00 in an empty list', () => {
    expect(newChapterRow([]).time).toBe('0:00');
    expect(newChapterRow([row('0:00'), row('1:30')]).time).toBe('2:30');
  });

  it('sorts by time on commit, keeps unreadable times at the end, and cleans the time text', () => {
    expect(sortRows([row('2:00', 'b'), row('x', 'z'), row('0:30', 'a')]).map((r) => r.title)).toEqual(['a', 'b', 'z']);
    expect(commitTime(' 90 ')).toBe('1:30');
    expect(commitTime('1m5s')).toBe('1:05');
    expect(commitTime('abc ')).toBe('abc');
  });
});

describe('live validation of the rows', () => {
  it('flags unreadable times, wrong order, missing 0:00, empty titles, and the length of the video', () => {
    expect(rowProblems([row('0:00'), row('0:30'), row('1:00')])).toEqual([]);
    expect(rowProblems([row('0:00'), row('nope'), row('1:00')]).map((p) => [p.code, p.index])).toEqual([['INVALID_TIME', 1]]);
    expect(rowProblems([row('0:10'), row('0:30'), row('1:00')]).map((p) => p.code)).toEqual(['FIRST_NOT_ZERO']);
    expect(rowProblems([row('0:00'), row('1:00'), row('0:30')]).map((p) => p.code)).toEqual(['NOT_ASCENDING']);
    expect(rowProblems([row('0:00'), row('0:30', ' '), row('1:00')]).map((p) => p.code)).toEqual(['TITLE_EMPTY']);
    expect(rowProblems([row('0:00'), row('0:30')]).map((p) => p.code)).toEqual(['TOO_FEW']);
    expect(rowProblems([row('0:00'), row('0:30'), row('1:00')], 65).map((p) => p.code)).toEqual(['BEYOND_DURATION']);
  });

  it('every problem has a message in Polish and in English', () => {
    const codes = ['TOO_FEW', 'TOO_MANY', 'FIRST_NOT_ZERO', 'NOT_ASCENDING', 'DUPLICATE_START', 'TOO_CLOSE', 'BEYOND_DURATION', 'TITLE_EMPTY', 'TITLE_TOO_LONG', 'INVALID_TIME'] as const;
    for (const code of codes) {
      expect(problemText({ code }, tx).trim()).not.toBe('');
      expect(problemText({ code }, txEn)).toMatch(/[a-z]/);
      expect(problemText({ code }, tx)).not.toContain('{');
    }
    expect(problemText({ code: 'TOO_FEW' }, txEn)).toBe('Add at least 3 chapters.');
    expect(skippedReasonText('NO_TITLE', txEn)).toBe('no title');
  });
});

describe('import from the descriptions', () => {
  it('takes the list from the Polish description and the English titles from the same times', () => {
    const result = importFromDescriptions('0:00 Wstęp\n1:00 Temat\n2:00\n3:00 Koniec', '0:00 Intro\n1:00 Topic\n9:00 Elsewhere');
    expect(result.rows.map((r) => [r.time, r.title, r.titleEn])).toEqual([
      ['0:00', 'Wstęp', 'Intro'],
      ['1:00', 'Temat', 'Topic'],
      ['3:00', 'Koniec', ''],
    ]);
    expect(result.skipped).toEqual([{ line: 3, text: '2:00', reason: 'NO_TITLE' }]);
  });

  it('finds nothing in a description without timestamps and never invents 0:00', () => {
    expect(importFromDescriptions('Just text', '').rows).toEqual([]);
    expect(importFromDescriptions('0:20 A\n1:00 B\n2:00 C', '').rows.map((r) => r.time)).toEqual(['0:20', '1:00', '2:00']);
  });
});

describe('dirty state and the form of a saved video', () => {
  const base: EditorForm = {
    title: 'A', titleEn: '', description: '', descriptionEn: '', tier: 'PUBLIC', premiere: '', tags: [], category: '', commentsMode: 'ON', isAdult: false, chapters: [],
  };

  it('compares chapters by content, not by line key', () => {
    const a = [row('0:00', 'A'), row('0:30', 'B')];
    const b = a.map((r) => ({ ...r, key: `other-${r.key}` }));
    expect(areChaptersEqual(a, b)).toBe(true);
    expect(areChaptersEqual(a, [a[0]!])).toBe(false);
    expect(areChaptersEqual(a, [a[0]!, { ...a[1]!, title: 'C' }])).toBe(false);
    expect(areChaptersEqual(undefined, [])).toBe(true);
    expect(isFormDirty({ ...base, chapters: a }, { ...base, chapters: b })).toBe(false);
    expect(isFormDirty({ ...base, chapters: [...a, row('1:00')] }, { ...base, chapters: a })).toBe(true);
    expect(isFormDirty({ ...base, title: 'B' }, base)).toBe(true);
  });

  it('videoToForm puts the saved chapters into rows', () => {
    const form = videoToForm({
      id: 'v', title: 'T', titleEn: null, description: null, descriptionEn: null, slug: 's', status: 'DRAFT', tier: 'PUBLIC', thumbnailUrl: null, premiereAt: null, views: 0, createdAt: '', publishedAt: null,
      chapters: [{ startSeconds: 0, title: 'A' }, { startSeconds: 60, title: 'B' }, { startSeconds: 120, title: 'C' }],
    });
    expect(form.chapters.map((r) => r.time)).toEqual(['0:00', '1:00', '2:00']);
    expect(videoToForm({ id: 'v', title: 'T', titleEn: null, description: null, descriptionEn: null, slug: 's', status: 'DRAFT', tier: 'PUBLIC', thumbnailUrl: null, premiereAt: null, views: 0, createdAt: '', publishedAt: null }).chapters).toEqual([]);
  });
});
