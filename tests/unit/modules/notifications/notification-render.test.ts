import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_LANGUAGES,
  NOTIFICATION_TEMPLATES,
  NOTIFICATION_TEMPLATE_KEYS,
  NOTIFICATION_TEMPLATE_PARAMS,
  notificationViewerLanguage,
  parseNotificationParams,
  renderNotification,
} from "@/lib/modules/notifications/domain/notification-render";
import { notificationTemplates } from "@/lib/modules/notifications/application/send-notification.use-case";
import { buildNewVideoCopy, buildNewVideoParams, buildPremiereCopy } from "@/lib/modules/notifications/domain/new-video";

const PARAMS = { text: "Ola: cześć {title}", channelName: "Kanał {x}", title: "Tytuł $& filmu" };

describe("notification templates", () => {
  it("has a non-empty title and body for every key in every language", () => {
    for (const key of NOTIFICATION_TEMPLATE_KEYS) {
      for (const lang of NOTIFICATION_LANGUAGES) {
        const copy = NOTIFICATION_TEMPLATES[key][lang];
        expect(copy.title.trim(), `${key}/${lang} title`).not.toBe("");
        expect(copy.body.trim(), `${key}/${lang} body`).not.toBe("");
      }
    }
  });

  it("keeps the same placeholders in all eight languages", () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of NOTIFICATION_TEMPLATE_KEYS) {
      const all = (lang: (typeof NOTIFICATION_LANGUAGES)[number]) => placeholders(NOTIFICATION_TEMPLATES[key][lang].title + " " + NOTIFICATION_TEMPLATES[key][lang].body);
      const needed = [...NOTIFICATION_TEMPLATE_PARAMS[key]].sort();
      for (const lang of NOTIFICATION_LANGUAGES) {
        expect(all(lang), `${key}/${lang}`).toEqual(all("en"));
        for (const name of all(lang)) expect(needed).toContain(name);
      }
    }
  });

  it("renders pl and en exactly like the stored fallback text", () => {
    const fixed = [
      ["welcome", notificationTemplates.welcome],
      ["support_thanks", notificationTemplates.supportThanks],
      ["creator_like", notificationTemplates.creatorLike],
      ["comment_like", notificationTemplates.commentLike],
    ] as const;
    for (const [key, t] of fixed) {
      expect(renderNotification(key, {}, "pl")).toEqual({ title: t.titlePl, body: t.bodyPl });
      expect(renderNotification(key, {}, "en")).toEqual({ title: t.titleEn, body: t.bodyEn });
    }
    const input = { channelName: "Kanał", title: "Film", titleEn: "Movie" };
    const nv = buildNewVideoCopy(input);
    const params = buildNewVideoParams(input);
    expect(renderNotification("new_video", params, "pl")).toEqual({ title: nv.titlePl, body: nv.bodyPl });
    expect(renderNotification("new_video", params, "en")).toEqual({ title: nv.titleEn, body: nv.bodyEn });
    const pr = buildPremiereCopy(input);
    expect(renderNotification("premiere", params, "pl")).toEqual({ title: pr.titlePl, body: pr.bodyPl });
    expect(renderNotification("premiere", params, "en")).toEqual({ title: pr.titleEn, body: pr.bodyEn });
  });

  it("renders every key in every language and inserts user text verbatim", () => {
    for (const key of NOTIFICATION_TEMPLATE_KEYS) {
      for (const lang of NOTIFICATION_LANGUAGES) {
        const out = renderNotification(key, PARAMS, lang);
        expect(out, `${key}/${lang}`).not.toBeNull();
        const plain = renderNotification(key, { text: "T", channelName: "C", title: "V" }, lang)!;
        expect(plain.title + plain.body, `${key}/${lang}`).not.toMatch(/\{\w+\}/);
      }
    }
    expect(renderNotification("comment_reply", PARAMS, "de")!.body).toBe("Ola: cześć {title}");
    expect(renderNotification("new_video", PARAMS, "fr")).toEqual({ title: "Nouvelle vidéo : Kanał {x}", body: "Tytuł $& filmu" });
    expect(renderNotification("premiere", PARAMS, "zh")).toEqual({ title: "首映：Tytuł $& filmu", body: "视频刚刚在 Kanał {x} 首映" });
  });

  it("shows the English video title in languages other than Polish when there is one", () => {
    const params = { channelName: "C", title: "Film", titleEn: "Movie" };
    expect(renderNotification("new_video", params, "pl")!.body).toBe("Film");
    expect(renderNotification("new_video", params, "de")!.body).toBe("Movie");
    expect(renderNotification("premiere", params, "es")!.title).toBe("Estreno: Movie");
    expect(renderNotification("new_video", { channelName: "C", title: "Film" }, "it")!.body).toBe("Film");
  });

  it("returns null so the caller falls back to the stored text", () => {
    expect(renderNotification(null, {}, "de")).toBeNull();
    expect(renderNotification("no_such_key", {}, "de")).toBeNull();
    expect(renderNotification("welcome", null, "xx")).toBeNull();
    expect(renderNotification("new_video", { channelName: "C" }, "de")).toBeNull(); // title missing
    expect(renderNotification("comment_reply", { text: 5 }, "de")).toBeNull(); // not a string
    expect(renderNotification("welcome", ["x"], "de")).toEqual({
      title: NOTIFICATION_TEMPLATES.welcome.de.title,
      body: NOTIFICATION_TEMPLATES.welcome.de.body,
    });
  });

  it("parses params defensively and maps the viewer language", () => {
    expect(parseNotificationParams(null)).toBeNull();
    expect(parseNotificationParams("x")).toBeNull();
    expect(parseNotificationParams([1])).toBeNull();
    expect(parseNotificationParams({ a: "x", b: 1, c: null })).toEqual({ a: "x" });
    expect(notificationViewerLanguage("zh")).toBe("zh");
    expect(notificationViewerLanguage("pl")).toBe("pl");
    expect(notificationViewerLanguage("ru")).toBe("en");
    expect(notificationViewerLanguage(undefined)).toBe("en");
  });
});
