"use client";
import { useEffect, useRef, useState } from "react";
import { readSingleKeyShortcuts, writeSingleKeyShortcuts } from "@admin/lib/single-key-shortcuts";
import { Icon } from "../icons";

const ROWS: [string[], string][] = [
  [["Ctrl", "K"], "Paleta poleceń: szukaj i wykonuj (⌘ K na Macu)"],
  [["?"], "Ta lista"],
  [["g", "…"], "Przejdź: d Dzisiaj, a Analityka, t Treści, s Społeczność, p Przychody, k Komunikacja, y System, b Bezpieczeństwo, l Premiera, , Ustawienia"],
  [["/"], "Szukaj na liście (gdy ekran ma filtr)"],
  [["[", "]"], "Krótszy / dłuższy okres (ekran Dzisiaj)"],
  [["←", "→"], "Na wykresie (po fokusie): wartości punkt po punkcie"],
  [["j", "k"], "Moderacja: następny / poprzedni komentarz w kolejce"],
  [["h", "z", "p", "w"], "Moderacja: ukryj, zostaw (zatwierdź), wstrzymaj, wycisz autora; „Cofnij” w powiadomieniu"],
  [["Esc"], "Zamknij okno, menu albo paletę"],
];

/** List of keyboard shortcuts. Single-letter shortcuts never fire inside inputs or dialogs and can be switched off here (WCAG 2.1.4). */
export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [singleKeys, setSingleKeys] = useState(true);
  useEffect(() => {
    if (open) setSingleKeys(readSingleKeyShortcuts());
  }, [open]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="modal" aria-labelledby="shortcuts-title" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div className="modal-head">
        <h2 id="shortcuts-title">Skróty klawiszowe</h2>
        <button type="button" className="icon-btn" aria-label="Zamknij" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <div className="modal-body">
        <label className="field-check" style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={singleKeys}
            onChange={(e) => {
              setSingleKeys(e.target.checked);
              writeSingleKeyShortcuts(e.target.checked);
            }}
          />
          <span>
            Skróty jednoznakowe włączone (g…, ?, /, [ ], j, k, h, z, p, w). Wyłącz, jeśli piszesz dyktowaniem albo urządzeniem, które wysyła pojedyncze litery. Ctrl K i Esc działają zawsze.
          </span>
        </label>
        <table className="table table-compact">
          <caption className="sr-only">Skróty klawiszowe</caption>
          <tbody>
            {ROWS.map(([keys, text]) => (
              <tr key={text}>
                <th scope="row" className="nowrap">
                  {keys.map((k, i) => (
                    <span key={i}>
                      {i ? " " : ""}
                      {k === "…" ? "potem litera" : <kbd>{k}</kbd>}
                    </span>
                  ))}
                </th>
                <td className="wrap">{text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="modal-foot">
        <button type="button" className="btn btn-primary" onClick={onClose} autoFocus>
          Zamknij
        </button>
      </div>
    </dialog>
  );
}
