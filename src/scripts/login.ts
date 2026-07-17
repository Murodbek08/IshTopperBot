/**
 * Telegram sessiya yaratuvchi (bir martalik).
 *
 * Ishga tushirish (serverda, docker ichida interaktiv):
 *   sudo docker compose run --rm --no-deps bot npx ts-node src/scripts/login.ts
 *
 * Telefon raqam + kodni kiriting — oxirida yangi SESSION_STRING chiqadi.
 * Uni .env dagi SESSION_STRING= ga qo'ying.
 */
import "dotenv/config";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import * as input from "input";

const apiId   = parseInt(process.env.API_ID ?? "", 10);
const apiHash = process.env.API_HASH ?? "";

async function main() {
  if (!apiId || !apiHash) {
    console.error("❌ API_ID / API_HASH .env da yo'q!");
    process.exit(1);
  }

  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: () => input.text("📱 Telefon raqam (+998...): "),
    password:    () => input.text("🔒 2FA parol (bo'lmasa Enter): "),
    phoneCode:   () => input.text("📨 SMS/Telegram kod: "),
    onError:     (e) => console.error(e),
  });

  console.log("\n\n✅ Yangi SESSION_STRING — .env dagi SESSION_STRING= ga qo'ying:\n");
  console.log(String(client.session.save()));
  console.log("\n");

  await client.disconnect();
  process.exit(0);
}

main();
