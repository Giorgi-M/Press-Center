import { createAdminClient } from "@/lib/supabase/server";

// Telegram bot webhook. The only thing the bot understands is
// "/start <token>" from the profile page link, which links the chat to the user.
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return new Response("forbidden", { status: 403 });
  }
  const update = await req.json().catch(() => null);
  const msg = update?.message;
  const text: string = msg?.text ?? "";
  const chatId = msg?.chat?.id;
  if (!chatId) return Response.json({ ok: true });

  const reply = async (t: string) =>
    fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: t }),
    });

  const m = text.match(/^\/start\s+([a-f0-9]{24})$/);
  if (!m) {
    await reply("გამარჯობა! ბოტის დასაკავშირებლად გამოიყენეთ ღილაკი პროფილის გვერდზე.");
    return Response.json({ ok: true });
  }
  const db = createAdminClient();
  const { data } = await db
    .from("profiles")
    .update({ telegram_chat_id: String(chatId) })
    .eq("telegram_link_token", m[1])
    .eq("active", true)
    .select("full_name")
    .maybeSingle();
  await reply(data ? `✅ ${data.full_name}, Telegram დაკავშირებულია. აქ მიიღებთ შეტყობინებებს გადაღებების შესახებ.` : "ბმული არასწორია ან ვადაგასულია.");
  return Response.json({ ok: true });
}
