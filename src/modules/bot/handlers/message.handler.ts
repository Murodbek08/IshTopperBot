import { Telegraf, Markup } from "telegraf";
import { mainKeyboard } from "./start.handler";
import { handleSearchQuery } from "./stats.handler";
import type { SessionStore } from "../session";
import { FIELDS } from "../filter-data";

export function registerMessageHandler(bot: Telegraf, sessions: SessionStore) {
  bot.on("text", async (ctx) => {
    const userId  = ctx.from.id;
    const text    = ctx.message.text.trim();
    const session = sessions.get(userId);

    if (!session) {
      await ctx.reply(
        "Buyruqni tushunmadim 🤔\n\nPastdagi tugmalardan foydalaning 👇",
        mainKeyboard(),
      );
      return;
    }

    // ── Qidirish so'rovi ─────────────────────────────────────────────────────
    if (session.step === "awaiting_search_query") {
      sessions.delete(userId);
      await handleSearchQuery(ctx, text);
      return;
    }

    // ── Custom texnologiya yozish ─────────────────────────────────────────────
    if (session.step === "awaiting_custom_tech") {
      const newTechs = text
        .split(/[,;/|]+/)
        .map((k) => k.trim())
        .filter((k) => k.length > 0 && k.length < 50);

      if (newTechs.length === 0) {
        await ctx.reply(
          "❌ Kamida bitta texnologiya kiriting.\n<i>Misol: React Native, GraphQL</i>",
          { parse_mode: "HTML" },
        );
        return;
      }

      const combined = [...new Set([...(session.technologies ?? []), ...newTechs])];
      sessions.set(userId, {
        ...session,
        step:         "awaiting_technologies",
        technologies: combined,
      });

      const field        = FIELDS[session.field!];
      const knownLabels  = field?.technologies.map((t) => t.label) ?? [];
      const customLabels = combined.filter((t) => !knownLabels.includes(t));
      const allLabels    = [...knownLabels, ...customLabels];

      const techBtns = allLabels.map((label) => {
        const isOn = combined.includes(label);
        return Markup.button.callback(isOn ? `✅ ${label}` : label, `tech:${label}`);
      });

      const rows: ReturnType<typeof Markup.button.callback>[][] = [];
      for (let i = 0; i < techBtns.length; i += 2) rows.push(techBtns.slice(i, i + 2));
      rows.push([Markup.button.callback("✏️ O'zim yozaman", "tech:__custom__")]);
      if (combined.length > 0) {
        rows.push([Markup.button.callback(`✅ Davom etish (${combined.length})`, "tech:__done__")]);
      }

      await ctx.reply(
        `✅ <b>Qo'shildi:</b> <code>${escapeHtml(newTechs.join(", "))}</code>\n\n` +
        `📌 Tanlangan: <code>${escapeHtml(combined.join(", "))}</code>`,
        { parse_mode: "HTML", ...Markup.inlineKeyboard(rows) },
      );
      return;
    }

    // ── Boshqa noma'lum holat ────────────────────────────────────────────────
    const stepNames: Record<string, string> = {
      awaiting_field:        "1/6 — Soha tanlang",
      awaiting_technologies: "2/6 — Texnologiyalar",
      awaiting_custom_tech:  "2/6 — Texnologiya yozing",
      awaiting_level:        "3/6 — Daraja",
      awaiting_work_type:    "4/6 — Ish turi",
      awaiting_location:     "5/6 — Hudud",
      awaiting_salary:       "6/6 — Maosh",
      awaiting_silent_from:  "Sokin soat — boshlanishi",
      awaiting_silent_to:    "Sokin soat — tugashi",
    };

    await ctx.reply(
      `⚠️ <b>Hozir ${stepNames[session.step] ?? "jarayon"} bosqichidasiz</b>\n\n` +
      `Tugmalardan foydalaning 👇\n` +
      `<i>/start — bosh menyuga qaytish</i>`,
      { parse_mode: "HTML" },
    );
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
