import { describe, it, expect } from 'vitest';
import {
  CHAPTERS_MAX,
  CHAPTERS_MIN,
  CHAPTER_MIN_GAP_SECONDS,
  CHAPTER_TITLE_MAX,
  activeChapterIndex,
  adjacentChapterStart,
  buildChapterSegments,
  chapterWindowEnd,
  normalizeChapters,
  parseChaptersFromDescription,
  parseStoredChapters,
  pickChapterTitle,
  scanTimestamps,
  validateChapters,
  type Chapter,
} from '@/lib/video-chapters';

const ch = (startSeconds: number, title = `T${startSeconds}`, titleEn?: string): Chapter => ({ startSeconds, title, ...(titleEn ? { titleEn } : {}) });
const valid: Chapter[] = [ch(0, 'Intro'), ch(30, 'Main'), ch(120, 'End')];
const codes = (chapters: readonly Chapter[], duration?: number | null) => validateChapters(chapters, duration).map((p) => p.code);

describe('normalizeChapters', () => {
  it('trims, collapses spaces, removes control characters and sorts by time', () => {
    const out = normalizeChapters([
      { startSeconds: 60, title: '  Second \n part\t' },
      { startSeconds: 0, title: 'Intro', titleEn: '  English   title ' },
    ]);
    expect(out).toEqual([
      { startSeconds: 0, title: 'Intro', titleEn: 'English title' },
      { startSeconds: 60, title: 'Second part' },
    ]);
  });

  it('drops garbage and an empty English title, keeps an empty Polish one for the validator', () => {
    const out = normalizeChapters([null, 'x', 5, { title: 'no time' }, { startSeconds: Number.NaN, title: 'nan' }, { startSeconds: 5 }, { startSeconds: 10, title: '  ', titleEn: '  ' }]);
    expect(out).toEqual([{ startSeconds: 10, title: '' }]);
    expect(normalizeChapters('nope')).toEqual([]);
    expect(normalizeChapters(null)).toEqual([]);
    expect(normalizeChapters({ 0: { startSeconds: 0, title: 'a' } })).toEqual([]);
  });

  it('floors fractional times and keeps the order of equal times', () => {
    expect(normalizeChapters([{ startSeconds: 10.9, title: 'b' }, { startSeconds: 10, title: 'a' }])).toEqual([
      { startSeconds: 10, title: 'b' },
      { startSeconds: 10, title: 'a' },
    ]);
  });
});

describe('validateChapters', () => {
  it('accepts no chapters and a good list', () => {
    expect(codes([])).toEqual([]);
    expect(codes(valid)).toEqual([]);
  });

  it('needs at least 3 chapters (1 and 2 are refused, exactly 3 is fine) and at most 50', () => {
    expect(CHAPTERS_MIN).toBe(3);
    expect(codes([ch(0)])).toContain('TOO_FEW');
    expect(codes([ch(0), ch(30)])).toContain('TOO_FEW');
    expect(codes(valid)).not.toContain('TOO_FEW');
    const many = (n: number) => Array.from({ length: n }, (_, i) => ch(i * CHAPTER_MIN_GAP_SECONDS));
    expect(codes(many(CHAPTERS_MAX))).toEqual([]);
    expect(codes(many(CHAPTERS_MAX + 1))).toContain('TOO_MANY');
  });

  it('the first chapter must start at 0:00', () => {
    expect(validateChapters([ch(5), ch(30), ch(60)])).toEqual([{ code: 'FIRST_NOT_ZERO', index: 0 }]);
  });

  it('wants at least 10 s between starts: exactly 10 is fine, 9 is too close', () => {
    expect(codes([ch(0), ch(10), ch(20)])).toEqual([]);
    expect(validateChapters([ch(0), ch(9), ch(30)])).toEqual([{ code: 'TOO_CLOSE', index: 1 }]);
  });

  it('reports a repeated start and a wrong order separately', () => {
    expect(validateChapters([ch(0), ch(30), ch(30), ch(60)])).toEqual([{ code: 'DUPLICATE_START', index: 2 }]);
    expect(validateChapters([ch(0), ch(60), ch(30)])).toEqual([{ code: 'NOT_ASCENDING', index: 2 }]);
  });

  it('checks the title: not empty and at most 80 characters (an emoji counts once)', () => {
    expect(validateChapters([ch(0, ''), ch(30), ch(60)])).toEqual([{ code: 'TITLE_EMPTY', index: 0 }]);
    expect(validateChapters([ch(0, 'a'.repeat(CHAPTER_TITLE_MAX)), ch(30), ch(60)])).toEqual([]);
    expect(validateChapters([ch(0, 'a'.repeat(CHAPTER_TITLE_MAX + 1)), ch(30), ch(60)])).toEqual([{ code: 'TITLE_TOO_LONG', index: 0 }]);
    expect(codes([ch(0, '😀'.repeat(CHAPTER_TITLE_MAX)), ch(30), ch(60)])).toEqual([]);
    expect(validateChapters([ch(0, 'ok', 'b'.repeat(CHAPTER_TITLE_MAX + 1)), ch(30), ch(60)])).toEqual([{ code: 'TITLE_TOO_LONG', index: 0 }]);
  });

  it('refuses a time that is not a whole number of seconds within 24 hours', () => {
    expect(codes([ch(0), ch(30.5), ch(60)])).toContain('INVALID_TIME');
    expect(codes([ch(0), ch(-1), ch(60)])).toContain('INVALID_TIME');
    expect(codes([ch(0), ch(30), ch(86401)])).toContain('INVALID_TIME');
    expect(codes([ch(0), ch(30), ch(86400)])).not.toContain('INVALID_TIME');
  });

  it('knows the length of the video only when it is given', () => {
    // Last start must be at most duration - 10.
    expect(codes(valid, 130)).toEqual([]);
    expect(validateChapters(valid, 129)).toEqual([{ code: 'BEYOND_DURATION', index: 2 }]);
    expect(codes(valid, 100)).toEqual(['BEYOND_DURATION']);
    // Unknown length: only the structural rules.
    expect(codes(valid, null)).toEqual([]);
    expect(codes(valid, undefined)).toEqual([]);
    expect(codes(valid, 0)).toEqual([]);
  });
});

describe('parseStoredChapters', () => {
  it('returns a good stored list, normalized', () => {
    expect(parseStoredChapters([{ startSeconds: 0, title: ' Intro ' }, { startSeconds: 30, title: 'B' }, { startSeconds: 60, title: 'C', titleEn: 'See' }])).toEqual([
      { startSeconds: 0, title: 'Intro' },
      { startSeconds: 30, title: 'B' },
      { startSeconds: 60, title: 'C', titleEn: 'See' },
    ]);
  });

  it('reads anything broken as "no chapters", never throws', () => {
    for (const bad of [null, undefined, 'x', 7, {}, { 0: valid[0] }, [], [{}], [null, null, null], [ch(0), ch(30)], [ch(5), ch(30), ch(60)], [ch(0), { startSeconds: 'x', title: 'y' }, ch(60)]]) {
      expect(parseStoredChapters(bad)).toEqual([]);
    }
    expect(parseStoredChapters(Array.from({ length: CHAPTERS_MAX + 1 }, (_, i) => ch(i * 10)))).toEqual([]);
  });
});

describe('pickChapterTitle', () => {
  it('Polish keeps the Polish title, every other language reads English when there is one', () => {
    const chapter = ch(0, 'Wstęp', 'Intro');
    expect(pickChapterTitle(chapter, 'pl')).toBe('Wstęp');
    expect(pickChapterTitle(chapter, 'en')).toBe('Intro');
    expect(pickChapterTitle(chapter, 'de')).toBe('Intro');
    expect(pickChapterTitle(ch(0, 'Wstęp'), 'de')).toBe('Wstęp');
    expect(pickChapterTitle(ch(0, 'Wstęp'), 'en')).toBe('Wstęp');
  });
});

describe('position helpers', () => {
  it('activeChapterIndex is the last chapter that has started, -1 when none', () => {
    expect(activeChapterIndex(valid, 0)).toBe(0);
    expect(activeChapterIndex(valid, 29.9)).toBe(0);
    expect(activeChapterIndex(valid, 30)).toBe(1);
    expect(activeChapterIndex(valid, 9999)).toBe(2);
    expect(activeChapterIndex(valid, -1)).toBe(-1);
    expect(activeChapterIndex([], 5)).toBe(-1);
    expect(activeChapterIndex(valid, Number.NaN)).toBe(-1);
  });

  it('adjacentChapterStart: next goes to the following chapter and stops at the last', () => {
    expect(adjacentChapterStart(valid, 0, 1)).toBe(30);
    expect(adjacentChapterStart(valid, 45, 1)).toBe(120);
    expect(adjacentChapterStart(valid, 500, 1)).toBeNull();
    expect(adjacentChapterStart([], 0, 1)).toBeNull();
  });

  it('adjacentChapterStart: previous restarts a chapter that ran more than 3 s, otherwise goes back one', () => {
    expect(adjacentChapterStart(valid, 40, -1)).toBe(30); // 10 s in: restart
    expect(adjacentChapterStart(valid, 33, -1)).toBe(0); // exactly 3 s is not "more than 3 s"
    expect(adjacentChapterStart(valid, 34, -1)).toBe(30);
    expect(adjacentChapterStart(valid, 31, -1)).toBe(0); // 1 s in: the previous chapter
    expect(adjacentChapterStart(valid, 130, -1)).toBe(120);
    expect(adjacentChapterStart(valid, 1, -1)).toBe(0); // first chapter restarts at its own start
    expect(adjacentChapterStart([], 5, -1)).toBeNull();
  });

  it('chapterWindowEnd and buildChapterSegments end the last chapter at the length of the video', () => {
    expect(chapterWindowEnd(valid, 0, 600)).toBe(30);
    expect(chapterWindowEnd(valid, 2, 600)).toBe(600);
    expect(buildChapterSegments(valid, 600)).toEqual([
      { start: 0, end: 30, title: 'Intro' },
      { start: 30, end: 120, title: 'Main' },
      { start: 120, end: 600, title: 'End' },
    ]);
  });

  it('buildChapterSegments leaves out chapters at or past the end and gives nothing for an unknown length', () => {
    expect(buildChapterSegments(valid, 100)).toEqual([
      { start: 0, end: 30, title: 'Intro' },
      { start: 30, end: 100, title: 'Main' },
    ]);
    expect(buildChapterSegments(valid, 0)).toEqual([]);
    expect(buildChapterSegments(valid, Number.NaN)).toEqual([]);
  });
});

describe('scanTimestamps', () => {
  const scan = (text: string) => scanTimestamps(text).map((m) => [text.slice(m.index, m.index + m.length), m.seconds]);

  it('finds m:ss, mm:ss, h:mm:ss and hh:mm:ss with their positions', () => {
    expect(scan('Start 0:00, then 12:30 and 1:02:03 or 01:05:09.')).toEqual([
      ['0:00', 0],
      ['12:30', 750],
      ['1:02:03', 3723],
      ['01:05:09', 3909],
    ]);
    const text = 'at 2:05 ok';
    expect(scanTimestamps(text)).toEqual([{ index: 3, length: 4, seconds: 125 }]);
  });

  it('ignores things that only look like times', () => {
    expect(scan('12:60 3:5 1:2:3 100:00:00 ratio 10:30:5 12:305')).toEqual([]);
    expect(scan('99:59:59')).toEqual([]); // beyond 24 hours
    expect(scan('')).toEqual([]);
  });

  it('a time in prose ("20:00") is a timestamp too (same grammar as YouTube)', () => {
    expect(scan('Spotkanie o 20:00 w piątek')).toEqual([['20:00', 1200]]);
  });

  it('can be called repeatedly (no shared regex state)', () => {
    expect(scanTimestamps('1:00')).toHaveLength(1);
    expect(scanTimestamps('1:00')).toHaveLength(1);
  });
});

describe('parseChaptersFromDescription', () => {
  const titles = (text: string) => parseChaptersFromDescription(text).chapters.map((c) => [c.startSeconds, c.title]);

  it('reads the usual forms of a chapter line', () => {
    expect(
      titles(['0:00 Wstęp', '00:30 - Drugi', '- 1:02 – Temat', '1:02:03 Koniec', '[2:10] Nawias', '(3:05) Okrągły', '4:05)Bez spacji', '• 5:00 | Kreska', '6:00: Dwukropek'].join('\n')),
    ).toEqual([
      [0, 'Wstęp'],
      [30, 'Drugi'],
      [62, 'Temat'],
      [130, 'Nawias'],
      [185, 'Okrągły'],
      [245, 'Bez spacji'],
      [300, 'Kreska'],
      [360, 'Dwukropek'],
      [3723, 'Koniec'],
    ]);
  });

  it('handles CRLF and an English description', () => {
    expect(titles('0:00 Intro\r\n1:00 Main part\r\n2:00 Outro')).toEqual([
      [0, 'Intro'],
      [60, 'Main part'],
      [120, 'Outro'],
    ]);
  });

  it('only a time at the start of a line counts; other lines and times in sentences are ignored', () => {
    const result = parseChaptersFromDescription('Cześć!\nSpotkamy się o 20:00 we wtorek\n0:00 Start\n\nKoniec 3:00');
    expect(result.chapters).toEqual([{ startSeconds: 0, title: 'Start' }]);
    expect(result.skipped).toEqual([]);
  });

  it('reports a line without a title, a repeated time (first wins) and a time over 24 hours', () => {
    const result = parseChaptersFromDescription('0:00 A\n1:00\n0:00 Again\n1:30 B\n99:59:59 Huge');
    expect(result.chapters).toEqual([
      { startSeconds: 0, title: 'A' },
      { startSeconds: 90, title: 'B' },
    ]);
    expect(result.skipped).toEqual([
      { line: 2, text: '1:00', reason: 'NO_TITLE' },
      { line: 3, text: '0:00 Again', reason: 'DUPLICATE_START' },
      { line: 5, text: '99:59:59 Huge', reason: 'INVALID_TIME' },
    ]);
  });

  it('sorts the result and does not repair it (no 0:00 added, no gaps fixed)', () => {
    const result = parseChaptersFromDescription('2:00 C\n0:05 A\n1:00 B');
    expect(result.chapters.map((c) => c.startSeconds)).toEqual([5, 60, 120]);
  });

  it('returns nothing for text without timestamps', () => {
    expect(parseChaptersFromDescription('Just a description.')).toEqual({ chapters: [], skipped: [] });
    expect(parseChaptersFromDescription('')).toEqual({ chapters: [], skipped: [] });
  });

  it('is fast on the longest description (5000 characters, many lines)', () => {
    const text = Array.from({ length: 400 }, (_, i) => `${Math.floor(i / 60)}:${String(i % 60).padStart(2, '0')} ${'x'.repeat(3)}`).join('\n').slice(0, 5000);
    const started = Date.now();
    const result = parseChaptersFromDescription(text);
    expect(Date.now() - started).toBeLessThan(200);
    expect(result.chapters.length).toBeGreaterThan(100);
    expect(parseChaptersFromDescription('9'.repeat(5000)).chapters).toEqual([]);
  });
});
