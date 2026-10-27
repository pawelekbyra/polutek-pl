import { pluralForm } from "@/lib/i18n/ui";
import type { Locale } from "@/lib/i18n/routing";

type Forms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

/**
 * Counted nouns, one entry per language with the forms its CLDR plural rules ask for
 * (pluralForm() picks by Intl.PluralRules): Polish has one/few/many, English/German/Italian/Spanish
 * one/other, French and Brazilian Portuguese treat 0 like 1, Chinese has a single form.
 */
const NOUNS = {
  views: {
    pl: { one: "wyświetlenie", few: "wyświetlenia", many: "wyświetleń", other: "wyświetlenia" },
    en: { one: "view", other: "views" },
    de: { one: "Aufruf", other: "Aufrufe" },
    es: { one: "visualización", other: "visualizaciones" },
    fr: { one: "vue", other: "vues" },
    it: { one: "visualizzazione", other: "visualizzazioni" },
    pt: { one: "visualização", other: "visualizações" },
    zh: { other: "次观看" },
  },
  comments: {
    pl: { one: "komentarz", few: "komentarze", many: "komentarzy", other: "komentarza" },
    en: { one: "comment", other: "comments" },
    de: { one: "Kommentar", other: "Kommentare" },
    es: { one: "comentario", other: "comentarios" },
    fr: { one: "commentaire", other: "commentaires" },
    it: { one: "commento", other: "commenti" },
    pt: { one: "comentário", other: "comentários" },
    zh: { other: "条评论" },
  },
  // The Polish brand word is "subskrajber"; with a digit the masculine-personal plural takes the genitive.
  subscribers: {
    pl: { one: "subskrajber", few: "subskrajberów", many: "subskrajberów", other: "subskrajberów" },
    en: { one: "subscriber", other: "subscribers" },
    de: { one: "Abonnent", other: "Abonnenten" },
    es: { one: "suscriptor", other: "suscriptores" },
    fr: { one: "abonné", other: "abonnés" },
    it: { one: "iscritto", other: "iscritti" },
    pt: { one: "inscrito", other: "inscritos" },
    zh: { other: "订阅者" },
  },
  videos: {
    pl: { one: "film", few: "filmy", many: "filmów", other: "filmu" },
    en: { one: "video", other: "videos" },
    de: { one: "Video", other: "Videos" },
    es: { one: "vídeo", other: "vídeos" },
    fr: { one: "vidéo", other: "vidéos" },
    it: { one: "video", other: "video" },
    pt: { one: "vídeo", other: "vídeos" },
    zh: { other: "个视频" },
  },
} as const satisfies Record<string, Record<Locale, Forms>>;

export type CountedNoun = keyof typeof NOUNS;

/** "film" / "filmy" / "filmów" for a count, in the interface language. */
export function countedNoun(language: Locale, noun: CountedNoun, count: number): string {
  return pluralForm(language, count, NOUNS[noun][language] as Forms);
}
