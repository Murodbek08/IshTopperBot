import { Telegraf, Markup } from "telegraf";
import { mainKeyboard } from "./start.handler";
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

    // ── Custom texnologiya yozish ──────────────────────────────────────────
    if (session.step === "awaiting_custom_tech") {
      const newTechs = text
        .split(/[,;]+/)
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      if (newTechs.length === 0) {
        await ctx.reply("❌ Kamida bitta texnologiya kiriting.");
        return;
      }

      const combined = [...(session.technologies ?? []), ...newTechs];
      sessions.set(userId, {
        ...session,
        step: "awaiting_technologies",
        technologies: combined,
      });

      const fieldKey = session.field!;
      const field    = FIELDS[fieldKey];

      // Yangilangan texnologiyalar bilan keyboard qayta ko'rsatamiz
      const allTechLabels = [
        ...(field?.technologies.map((t) => t.label) ?? []),
        ...newTechs.filter(
          (t) => !field?.technologies.some((ft) => ft.label === t),
        ),
      ];

      const techBtns = allTechLabels.map((label) => {
        const isOn = combined.includes(label);
        return Markup.button.callback(
          isOn ? `✅ ${label}` : label,
          `tech:${label}`,
        );
      });

      const rows: ReturnType<typeof Markup.button.callback>[][] = [];
      for (let i = 0; i < techBtns.length; i += 2) {
        rows.push(techBtns.slice(i, i + 2));
      }
      rows.push([Markup.button.callback("✏️ O'zim yozaman", "tech:__custom__")]);
      if (combined.length > 0) {
        rows.push([
          Markup.button.callback(
            `✅ Davom etish (${combined.length})`,
            "tech:__done__",
          ),
        ]);
      }

      await ctx.reply(
        `✅ <b>Qo'shildi:</b> <code>${newTechs.join(", ")}</code>\n\n` +
        `Jami tanlangan: <code>${combined.join(", ")}</code>\n\n` +
        `Davom etish uchun <b>✅ Davom etish</b> tugmasini bosing yoki yana tanlang.`,
        { parse_mode: "HTML", ...Markup.inlineKeyboard(rows) },
      );
      return;
    }

    // Boshqa noma'lum holat
    sessions.delete(userId);
    await ctx.reply(
      "Buyruqni tushunmadim 🤔\n\nPastdagi tugmalardan foydalaning 👇",
      mainKeyboard(),
    );
  });
}
