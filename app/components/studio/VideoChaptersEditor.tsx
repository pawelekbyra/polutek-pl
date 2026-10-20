"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/app/components/LanguageContext";
import { CHAPTERS_MAX, CHAPTERS_MIN, CHAPTER_MIN_GAP_SECONDS, CHAPTER_TITLE_MAX, type ChapterProblem } from "@/lib/video-chapters";
import ConfirmDialog from "./ConfirmDialog";
import {
  commitTime,
  importFromDescriptions,
  newChapterRow,
  problemText,
  rowProblems,
  skippedReasonText,
  sortRows,
  type ChapterRow,
  type ChaptersImport,
} from "./chapters-form";
import { Notice, inputClass, smallDangerGhostButtonClass, smallGhostButtonClass } from "./ui";

const TIME_PROBLEMS: ReadonlySet<ChapterProblem["code"]> = new Set(["INVALID_TIME", "FIRST_NOT_ZERO", "NOT_ASCENDING", "DUPLICATE_START", "TOO_CLOSE", "BEYOND_DURATION"]);
const ID = "ed-chapters";
const rowInput = `${inputClass} min-h-10`;

interface Props {
  rows: ChapterRow[];
  onChange: (rows: ChapterRow[]) => void;
  /** Length of the video in seconds when known (a chapter must start at least 10 s before the end). */
  durationSeconds: number | null;
  tier: "PUBLIC" | "LOGGED_IN";
  /** The Polish and the English description of the form, the source of "Import from description". */
  descriptions: { pl: string; en: string };
  disabled?: boolean;
}

/**
 * Studio -> video editor -> "Chapters (optional)": a list of lines (time, Polish title, English title). The lines
 * sort by time when a time is committed (blur or Enter), never while typing. Nothing is saved here: the list is part
 * of the editor form and goes out with the one `PATCH` of "Zapisz". The rules are in `chapters-form.ts`.
 */
export default function VideoChaptersEditor({ rows, onChange, durationSeconds, tier, descriptions, disabled = false }: Props) {
  const { tx } = useLanguage();
  const [open, setOpen] = useState(rows.length > 0);
  const [pending, setPending] = useState<ChaptersImport | null>(null);
  const [report, setReport] = useState<{ text: string; skipped: ChaptersImport["skipped"] } | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const timeRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const addRef = useRef<HTMLButtonElement>(null);

  // After "Add chapter" the focus goes to the time of the new line.
  useEffect(() => {
    if (!focusKey) return;
    timeRefs.current[focusKey]?.focus();
    setFocusKey(null);
  }, [focusKey, rows]);

  const problems = rowProblems(rows, durationSeconds);
  const listProblems = problems.filter((problem) => problem.index === undefined);
  const rowMessages = (index: number) => [...new Set(problems.filter((problem) => problem.index === index).map((problem) => problemText(problem, tx)))];
  const timeInvalid = (index: number) => problems.some((problem) => problem.index === index && TIME_PROBLEMS.has(problem.code));
  const titleInvalid = (index: number, code: "TITLE_EMPTY" | "TITLE_TOO_LONG", value: string) =>
    problems.some((problem) => problem.index === index && problem.code === code) && (code === "TITLE_EMPTY" ? !value.trim() : [...value].length > CHAPTER_TITLE_MAX);

  const update = (key: string, patch: Partial<ChapterRow>) => onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const commit = (key: string) => {
    const row = rows.find((candidate) => candidate.key === key);
    if (row) onChange(sortRows(rows.map((candidate) => (candidate.key === key ? { ...candidate, time: commitTime(row.time) } : candidate))));
  };
  const add = () => {
    const row = newChapterRow(rows);
    onChange([...rows, row]);
    setFocusKey(row.key);
  };
  const remove = (key: string) => {
    onChange(rows.filter((row) => row.key !== key));
    addRef.current?.focus();
  };

  const apply = (result: ChaptersImport) => {
    onChange(sortRows(result.rows));
    setReport({ text: tx("Wczytano {0} rozdziałów, pominięto {1} linii.", "Imported {0} chapters, skipped {1} lines.", result.rows.length, result.skipped.length), skipped: result.skipped });
  };
  const importDescription = () => {
    const result = importFromDescriptions(descriptions.pl, descriptions.en);
    if (result.rows.length === 0) {
      setReport({ text: tx("W opisie nie znaleziono znaczników czasu na początku linii.", "No timestamps found at the start of a line in the description."), skipped: result.skipped });
    } else if (rows.length > 0) {
      setPending(result);
    } else {
      apply(result);
    }
  };

  // Enter must not submit the whole form from a chapter field.
  const onTimeKey = (event: React.KeyboardEvent<HTMLInputElement>, key: string) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commit(key);
  };
  const onTitleKey = (event: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (index === rows.length - 1 && problems.length === 0 && rows.length < CHAPTERS_MAX) add();
  };

  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="rounded-xl border border-[var(--chan-line)] p-3">
      <summary className="min-h-8 cursor-pointer text-[14px] font-semibold text-[var(--chan-ink)]">
        {tx("Rozdziały (opcjonalnie)", "Chapters (optional)")}
        {rows.length > 0 && <span className="font-normal text-[var(--chan-muted)]">{` (${rows.length})`}</span>}
      </summary>
      <div className="mt-4 grid gap-3">
        <p id={`${ID}-hint`} className="text-[12px] text-[var(--chan-muted)]">
          {tx(
            "Pierwszy rozdział zaczyna się w 0:00, co najmniej {0} rozdziały, każdy minimum {1} s.",
            "The first chapter starts at 0:00, at least {0} chapters, each at least {1} s.",
            CHAPTERS_MIN,
            CHAPTER_MIN_GAP_SECONDS,
          )}
          {tier === "LOGGED_IN" &&
            ` ${tx(
              "Tytuły rozdziałów widzą tylko osoby, które mogą obejrzeć film; opis jest widoczny dla wszystkich.",
              "Chapter titles are visible only to people who can watch the video; the description is visible to everyone.",
            )}`}
        </p>

        {(problems.length > 0 || listProblems.length > 0) && (
          <Notice kind="error">
            {tx("Popraw listę rozdziałów, zanim zapiszesz.", "Fix the chapter list before saving.")}
            {listProblems.map((problem) => ` ${problemText(problem, tx)}`)}
          </Notice>
        )}

        {rows.length > 0 && (
          <ul className="grid gap-2">
            {rows.map((row, index) => {
              const messages = rowMessages(index);
              const errorId = `${ID}-${index}-error`;
              return (
                <li key={row.key} className="grid gap-1">
                  <div className="grid grid-cols-[84px_minmax(0,1fr)_auto] items-start gap-2 sm:grid-cols-[84px_minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <input
                      ref={(element) => {
                        timeRefs.current[row.key] = element;
                      }}
                      className={`${rowInput} tabular-nums`}
                      inputMode="numeric"
                      autoComplete="off"
                      value={row.time}
                      disabled={disabled}
                      aria-label={tx("Czas rozdziału {0}", "Chapter {0} time", index + 1)}
                      aria-invalid={timeInvalid(index) || undefined}
                      aria-describedby={messages.length > 0 ? errorId : undefined}
                      onChange={(event) => update(row.key, { time: event.target.value })}
                      onBlur={() => commit(row.key)}
                      onKeyDown={(event) => onTimeKey(event, row.key)}
                    />
                    <input
                      className={rowInput}
                      value={row.title}
                      disabled={disabled}
                      aria-label={tx("Tytuł rozdziału {0} (PL)", "Chapter {0} title (PL)", index + 1)}
                      aria-invalid={titleInvalid(index, "TITLE_EMPTY", row.title) || titleInvalid(index, "TITLE_TOO_LONG", row.title) || undefined}
                      aria-describedby={messages.length > 0 ? errorId : undefined}
                      onChange={(event) => update(row.key, { title: event.target.value })}
                      onKeyDown={(event) => onTitleKey(event, index)}
                    />
                    <button
                      type="button"
                      className={`${smallDangerGhostButtonClass} min-h-10 sm:order-last`}
                      disabled={disabled}
                      aria-label={tx("Usuń rozdział {0}", "Remove chapter {0}", index + 1)}
                      onClick={() => remove(row.key)}
                    >
                      ✕
                    </button>
                    <input
                      className={`${rowInput} col-span-2 col-start-2 sm:col-span-1 sm:col-start-auto`}
                      value={row.titleEn}
                      disabled={disabled}
                      aria-label={tx("Tytuł rozdziału {0} (EN, opcjonalnie)", "Chapter {0} title (EN, optional)", index + 1)}
                      aria-invalid={titleInvalid(index, "TITLE_TOO_LONG", row.titleEn) || undefined}
                      onChange={(event) => update(row.key, { titleEn: event.target.value })}
                      onKeyDown={(event) => onTitleKey(event, index)}
                    />
                  </div>
                  {messages.length > 0 && (
                    <p id={errorId} className="text-[12px] text-red-700">
                      {messages.join(" ")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-wrap gap-2">
          <button ref={addRef} type="button" className={smallGhostButtonClass} disabled={disabled || rows.length >= CHAPTERS_MAX} onClick={add}>
            {tx("Dodaj rozdział", "Add chapter")}
          </button>
          <button type="button" className={smallGhostButtonClass} disabled={disabled} onClick={importDescription}>
            {tx("Importuj z opisu", "Import from description")}
          </button>
          {rows.length > 0 && (
            <button type="button" className={smallGhostButtonClass} disabled={disabled} onClick={() => onChange([])}>
              {tx("Wyczyść wszystkie", "Clear all")}
            </button>
          )}
        </div>

        {report && (
          <Notice>
            {report.text}
            {report.skipped.length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-[12px] font-semibold">{tx("Pominięte linie", "Skipped lines")}</summary>
                <ul className="mt-1 grid gap-0.5 text-[12px]">
                  {report.skipped.map((line) => (
                    <li key={line.line}>{`${tx("Linia {0}", "Line {0}", line.line)}: ${line.text} (${skippedReasonText(line.reason, tx)})`}</li>
                  ))}
                </ul>
              </details>
            )}
          </Notice>
        )}
      </div>

      {pending && (
        <ConfirmDialog
          title={tx("Zastąpić listę rozdziałów?", "Replace the chapter list?")}
          confirmLabel={tx("Zastąp", "Replace")}
          cancelLabel={tx("Anuluj", "Cancel")}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            apply(pending);
            setPending(null);
          }}
        >
          {tx(
            "Obecna lista ({0}) zostanie zastąpiona rozdziałami z opisu ({1}). Nic nie jest zapisane, dopóki nie klikniesz „Zapisz”.",
            "The current list ({0}) will be replaced by the chapters from the description ({1}). Nothing is saved until you click “Save”.",
            rows.length,
            pending.rows.length,
          )}
        </ConfirmDialog>
      )}
    </details>
  );
}
