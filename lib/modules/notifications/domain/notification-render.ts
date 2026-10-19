/**
 * Renders a notification in the viewer's UI language (CLAUDE.md, notifications). Rows keep their finished
 * Polish and English text as the fallback; a row that also carries `templateKey` + `params` can be shown in any of
 * the eight UI languages. Pure: no I/O. These are not tx() strings, the tables live here.
 *
 * User-generated pieces (names, comment snippets, titles) arrive in `params` and are inserted verbatim, in one
 * pass, so a value that happens to contain `{something}` is never expanded.
 */

export const NOTIFICATION_LANGUAGES = ["pl", "en", "de", "es", "fr", "it", "pt", "zh"] as const;
export type NotificationLanguage = (typeof NOTIFICATION_LANGUAGES)[number];

export const NOTIFICATION_TEMPLATE_KEYS = [
  "welcome",
  "support_thanks",
  "comment_reply",
  "creator_like",
  "comment_like",
  "new_video",
  "premiere",
] as const;
export type NotificationTemplateKey = (typeof NOTIFICATION_TEMPLATE_KEYS)[number];

export type NotificationParams = Record<string, string>;

type Copy = { title: string; body: string };

/** Placeholders each template needs; a row missing one falls back to its stored text. */
export const NOTIFICATION_TEMPLATE_PARAMS: Record<NotificationTemplateKey, readonly string[]> = {
  welcome: [],
  support_thanks: [],
  comment_reply: ["text"],
  creator_like: [],
  comment_like: [],
  new_video: ["channelName", "title"],
  premiere: ["channelName", "title"],
};

export const NOTIFICATION_TEMPLATES: Record<NotificationTemplateKey, Record<NotificationLanguage, Copy>> = {
  welcome: {
    pl: { title: "Witaj!", body: "Dziękujemy za dołączenie! Wszystkie filmy są dostępne po zalogowaniu." },
    en: { title: "Welcome!", body: "Thank you for joining! Every video is available once you are signed in." },
    de: { title: "Willkommen!", body: "Danke, dass du dabei bist! Alle Videos sind nach der Anmeldung verfügbar." },
    es: { title: "¡Bienvenido!", body: "¡Gracias por unirte! Todos los vídeos están disponibles al iniciar sesión." },
    fr: { title: "Bienvenue !", body: "Merci de nous avoir rejoints ! Toutes les vidéos sont disponibles une fois connecté." },
    it: { title: "Benvenuto!", body: "Grazie per esserti iscritto! Tutti i video sono disponibili dopo l'accesso." },
    pt: { title: "Bem-vindo!", body: "Obrigado por se juntar a nós! Todos os vídeos ficam disponíveis depois de entrar na sua conta." },
    zh: { title: "欢迎！", body: "感谢你的加入！登录后即可观看所有视频。" },
  },
  support_thanks: {
    pl: { title: "Dziękuję za wsparcie!", body: "Twój napiwek dotarł. Dziękuję, to dla mnie wiele znaczy." },
    en: { title: "Thank you for your support!", body: "Your tip has arrived. Thank you, it means a lot to me." },
    de: { title: "Danke für deine Unterstützung!", body: "Dein Trinkgeld ist angekommen. Danke, das bedeutet mir viel." },
    es: { title: "¡Gracias por tu apoyo!", body: "Tu propina ha llegado. Gracias, significa mucho para mí." },
    fr: { title: "Merci pour votre soutien !", body: "Votre pourboire est bien arrivé. Merci, cela compte beaucoup pour moi." },
    it: { title: "Grazie per il tuo supporto!", body: "La tua mancia è arrivata. Grazie, significa molto per me." },
    pt: { title: "Obrigado pelo seu apoio!", body: "Sua gorjeta chegou. Obrigado, isso significa muito para mim." },
    zh: { title: "感谢你的支持！", body: "你的打赏已送达。谢谢你，这对我意义重大。" },
  },
  comment_reply: {
    pl: { title: "Nowa odpowiedź na Twój komentarz", body: "{text}" },
    en: { title: "New reply to your comment", body: "{text}" },
    de: { title: "Neue Antwort auf deinen Kommentar", body: "{text}" },
    es: { title: "Nueva respuesta a tu comentario", body: "{text}" },
    fr: { title: "Nouvelle réponse à votre commentaire", body: "{text}" },
    it: { title: "Nuova risposta al tuo commento", body: "{text}" },
    pt: { title: "Nova resposta ao seu comentário", body: "{text}" },
    zh: { title: "你的评论有了新回复", body: "{text}" },
  },
  creator_like: {
    pl: { title: "Twórca polubił Twój komentarz", body: "Twórca kanału docenił Twój komentarz." },
    en: { title: "The creator liked your comment", body: "The channel's creator appreciated your comment." },
    de: { title: "Dein Kommentar gefällt dem Creator", body: "Der Creator des Kanals hat deinen Kommentar wertgeschätzt." },
    es: { title: "Al creador le gustó tu comentario", body: "El creador del canal valoró tu comentario." },
    fr: { title: "Le créateur a aimé votre commentaire", body: "Le créateur de la chaîne a apprécié votre commentaire." },
    it: { title: "Al creatore è piaciuto il tuo commento", body: "Il creatore del canale ha apprezzato il tuo commento." },
    pt: { title: "O criador curtiu seu comentário", body: "O criador do canal gostou do seu comentário." },
    zh: { title: "创作者赞了你的评论", body: "频道创作者很欣赏你的评论。" },
  },
  comment_like: {
    pl: { title: "Twój komentarz polubiono", body: "Komuś spodobał się Twój komentarz." },
    en: { title: "Your comment got a like", body: "Someone liked your comment." },
    de: { title: "Dein Kommentar hat ein „Gefällt mir“ bekommen", body: "Jemandem gefällt dein Kommentar." },
    es: { title: "Tu comentario recibió un me gusta", body: "A alguien le gustó tu comentario." },
    fr: { title: "Votre commentaire a reçu un j'aime", body: "Quelqu'un a aimé votre commentaire." },
    it: { title: "Il tuo commento ha ricevuto un mi piace", body: "A qualcuno è piaciuto il tuo commento." },
    pt: { title: "Seu comentário recebeu uma curtida", body: "Alguém curtiu seu comentário." },
    zh: { title: "你的评论收到了一个赞", body: "有人赞了你的评论。" },
  },
  new_video: {
    pl: { title: "Nowy film: {channelName}", body: "{title}" },
    en: { title: "New video: {channelName}", body: "{title}" },
    de: { title: "Neues Video: {channelName}", body: "{title}" },
    es: { title: "Nuevo vídeo: {channelName}", body: "{title}" },
    fr: { title: "Nouvelle vidéo : {channelName}", body: "{title}" },
    it: { title: "Nuovo video: {channelName}", body: "{title}" },
    pt: { title: "Novo vídeo: {channelName}", body: "{title}" },
    zh: { title: "新视频：{channelName}", body: "{title}" },
  },
  premiere: {
    pl: { title: "Premiera: {title}", body: "Film właśnie się zaczął na kanale {channelName}" },
    en: { title: "Premiere: {title}", body: "The video just premiered on {channelName}" },
    de: { title: "Premiere: {title}", body: "Das Video feiert gerade auf {channelName} Premiere" },
    es: { title: "Estreno: {title}", body: "El vídeo se acaba de estrenar en {channelName}" },
    fr: { title: "Première : {title}", body: "La vidéo vient d'être diffusée en première sur {channelName}" },
    it: { title: "Première: {title}", body: "Il video è appena andato in onda in anteprima su {channelName}" },
    pt: { title: "Estreia: {title}", body: "O vídeo acabou de estrear em {channelName}" },
    zh: { title: "首映：{title}", body: "视频刚刚在 {channelName} 首映" },
  },
};

export function isNotificationTemplateKey(value: unknown): value is NotificationTemplateKey {
  return typeof value === "string" && (NOTIFICATION_TEMPLATE_KEYS as readonly string[]).includes(value);
}

export function isNotificationLanguage(value: unknown): value is NotificationLanguage {
  return typeof value === "string" && (NOTIFICATION_LANGUAGES as readonly string[]).includes(value);
}

/** `Notification.params` is free JSON in the database: keep only the string values of a plain object. */
export function parseNotificationParams(value: unknown): NotificationParams | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: NotificationParams = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string") out[key] = v;
  }
  return out;
}

function fill(template: string, params: NotificationParams): string {
  // One pass with a callback: values are inserted verbatim (no `$&` expansion, no re-scanning).
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? params[name] : match,
  );
}

/**
 * Title and body of a keyed notification in `language`, or null when the key is unknown, the language has no
 * template or a required placeholder is missing (the caller then shows the stored Polish/English text).
 */
export function renderNotification(
  templateKey: string | null | undefined,
  params: unknown,
  language: string | null | undefined,
): { title: string; body: string } | null {
  if (!isNotificationTemplateKey(templateKey) || !isNotificationLanguage(language)) return null;
  const values = { ...(parseNotificationParams(params) ?? {}) };
  // Video titles exist in Polish (`title`) and, when translated, English (`titleEn`): every language but Polish shows English.
  if (language !== "pl" && values.titleEn?.trim()) values.title = values.titleEn;
  for (const name of NOTIFICATION_TEMPLATE_PARAMS[templateKey]) {
    if (typeof values[name] !== "string") return null;
  }
  const copy = NOTIFICATION_TEMPLATES[templateKey][language];
  return { title: fill(copy.title, values), body: fill(copy.body, values) };
}

/** The viewer's notification language: any of the eight UI languages, English for anything unknown. */
export function notificationViewerLanguage(language: string | null | undefined): NotificationLanguage {
  return isNotificationLanguage(language) ? language : "en";
}
