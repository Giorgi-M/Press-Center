import nodemailer, { type Transporter } from "nodemailer";

export type Channel = "email" | "sms" | "whatsapp" | "telegram";

export type OutgoingMessage = {
  subject: string;
  body: string;
  // Short values for the WhatsApp template parameters.
  fields: { title: string; when: string; place: string; position: string };
};

// A channel is live only when its credentials are configured, so the app runs
// with any subset of them (e.g. Telegram can be switched on later).
export function channelEnabled(c: Channel): boolean {
  switch (c) {
    case "email":
      return !!process.env.SMTP_HOST;
    case "sms":
      return !!process.env.SMS_PROVIDER;
    case "whatsapp":
      return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
    case "telegram":
      return !!process.env.TELEGRAM_BOT_TOKEN;
  }
}

// Georgian mobile numbers in international form without "+": 9955XXXXXXXX.
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 9 && digits.startsWith("5")) return `995${digits}`;
  return digits;
}

let transporter: Transporter | null = null;

export async function sendEmail(to: string, msg: OutgoingMessage) {
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject: msg.subject,
    text: msg.body,
  });
}

// SMS goes through a pluggable provider chosen by SMS_PROVIDER.
export async function sendSms(phone: string, msg: OutgoingMessage) {
  const to = normalizePhone(phone);
  const provider = process.env.SMS_PROVIDER;
  if (provider === "log") {
    console.log(`[sms] -> ${to}: ${msg.body}`);
    return;
  }
  if (provider === "smsoffice") {
    const url = new URL("https://smsoffice.ge/api/v2/send/");
    url.searchParams.set("key", process.env.SMSOFFICE_API_KEY ?? "");
    url.searchParams.set("destination", to);
    url.searchParams.set("sender", process.env.SMS_SENDER ?? "");
    url.searchParams.set("content", msg.body);
    url.searchParams.set("urgent", "true");
    const res = await fetch(url);
    const data = await res.json().catch(() => null);
    if (!res.ok || (data && data.Success === false)) {
      throw new Error(`smsoffice: ${res.status} ${JSON.stringify(data)}`);
    }
    return;
  }
  if (provider === "twilio") {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: `+${to}`, From: process.env.SMS_SENDER ?? "", Body: msg.body }),
    });
    if (!res.ok) throw new Error(`twilio: ${res.status} ${await res.text()}`);
    return;
  }
  throw new Error(`unknown SMS_PROVIDER "${provider}"`);
}

// WhatsApp Cloud API. Messages the business starts must use an approved
// template; see README for the expected template layout.
export async function sendWhatsapp(phone: string, msg: OutgoingMessage) {
  const version = process.env.WHATSAPP_API_VERSION ?? "v21.0";
  const template = process.env.WHATSAPP_TEMPLATE;
  const payload = template
    ? {
        messaging_product: "whatsapp",
        to: normalizePhone(phone),
        type: "template",
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "ka" },
          components: [
            {
              type: "body",
              parameters: [msg.fields.title, msg.fields.when, msg.fields.place, msg.fields.position].map(
                (text) => ({ type: "text", text: text || "-" }),
              ),
            },
          ],
        },
      }
    : { messaging_product: "whatsapp", to: normalizePhone(phone), type: "text", text: { body: msg.body } };

  const res = await fetch(
    `https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) throw new Error(`whatsapp: ${res.status} ${await res.text()}`);
}

export async function sendTelegram(chatId: string, msg: OutgoingMessage) {
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: msg.body, disable_web_page_preview: true }),
  });
  if (!res.ok) throw new Error(`telegram: ${res.status} ${await res.text()}`);
}
