/**
 * "What can this person do" in plain words, derived from the same rules the site uses (two access levels,
 * no payment gating, commenting needs a finished nickname and no mute). Pure: the panel gives it rows, it gives
 * back sentences. It never changes anything; the audit row ADMIN_VIEW_AS is written by the use case that calls it.
 */
export type AccessSubject = { isDeleted: boolean; emailVerified: boolean; onboardingPending: boolean; commentMutedUntil: Date | null; role: "ADMIN" | "USER" };
export type AccessVideo = { id: string; slug: string; title: string; tier: "PUBLIC" | "LOGGED_IN" | "PATRON" };
export type FilmAccessRow = { videoId: string; slug: string; title: string; tier: "PUBLIC" | "LOGGED_IN"; canWatch: boolean; why: string };

export type AccessExplanation = {
  signIn: { ok: boolean; why: string };
  commenting: { ok: boolean; why: string };
  films: FilmAccessRow[];
};

export function explainAccess(subject: AccessSubject, videos: AccessVideo[], now: Date): AccessExplanation {
  const muted = subject.commentMutedUntil !== null && subject.commentMutedUntil > now;
  const signIn = subject.isDeleted
    ? { ok: false, why: "Konto jest usunięte i zanonimizowane: nie da się zalogować." }
    : { ok: true, why: subject.emailVerified ? "Konto aktywne, e-mail potwierdzony." : "Konto aktywne, ale e-mail nie jest potwierdzony." };
  const commenting = subject.isDeleted
    ? { ok: false, why: "Konto usunięte." }
    : subject.onboardingPending
      ? { ok: false, why: "Osoba nie wybrała jeszcze pseudonimu (okno powitalne), więc nie może komentować." }
      : muted
        ? { ok: false, why: "Komentowanie wyciszone przez moderację." }
        : { ok: true, why: "Może komentować i reagować pod filmami, do których ma dostęp." };
  const films = videos.map((v): FilmAccessRow => {
    // A leftover PATRON tier counts as LOGGED_IN (lib/access-tier.ts); nothing is gated by payment.
    const tier = v.tier === "PUBLIC" ? "PUBLIC" : "LOGGED_IN";
    if (tier === "PUBLIC") return { videoId: v.id, slug: v.slug, title: v.title, tier, canWatch: true, why: "Film publiczny: widzi każdy." };
    return subject.isDeleted
      ? { videoId: v.id, slug: v.slug, title: v.title, tier, canWatch: false, why: "Film dla zalogowanych, a konto jest usunięte." }
      : { videoId: v.id, slug: v.slug, title: v.title, tier, canWatch: true, why: "Film dla zalogowanych: ta osoba jest zalogowana, więc go widzi (napiwek niczego nie odblokowuje)." };
  });
  return { signIn, commenting, films };
}
