import { requireUser } from "@/lib/auth";
import { changePassword, saveProfile, unlinkTelegram } from "./actions";

export default async function ProfilePage() {
  const { profile, role } = await requireUser();
  const appUrl = process.env.APP_URL ?? "";
  const icsUrl = `${appUrl}/api/calendar/${profile.ics_token}`;
  const bot = process.env.TELEGRAM_BOT_USERNAME;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">პროფილი</h1>

      <form action={saveProfile} className="card space-y-3">
        <p className="text-sm text-gray-500">
          {profile.email}
          {profile.username && ` · @${profile.username}`} · {role?.name ?? "როლის გარეშე"}
        </p>
        <label className="block text-sm">სახელი გვარი<input name="full_name" className="input" defaultValue={profile.full_name} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">ტელეფონი<input name="phone" className="input" defaultValue={profile.phone ?? ""} inputMode="tel" /></label>
          <label className="block text-sm">WhatsApp<input name="whatsapp" className="input" defaultValue={profile.whatsapp ?? ""} inputMode="tel" placeholder="ცარიელი = ტელეფონი" /></label>
        </div>
        <fieldset className="space-y-1">
          <legend className="label">შეტყობინებები</legend>
          {[
            ["notify_email", "ელფოსტა", profile.notify_email],
            ["notify_sms", "SMS", profile.notify_sms],
            ["notify_whatsapp", "WhatsApp", profile.notify_whatsapp],
            ["notify_telegram", "Telegram", profile.notify_telegram],
          ].map(([name, label, on]) => (
            <label key={name as string} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={name as string} defaultChecked={on as boolean} /> {label as string}
            </label>
          ))}
        </fieldset>
        <button className="btn-primary">შენახვა</button>
      </form>

      <div className="card space-y-2">
        <h2 className="font-semibold">📅 Google Calendar</h2>
        <p className="text-sm text-gray-600">
          დაამატეთ ეს ბმული Google Calendar-ში: „სხვა კალენდრები“ → „+“ → „URL-ით“. თქვენი გადაღებები ავტომატურად გამოჩნდება.
        </p>
        <input readOnly className="input font-mono text-xs" value={icsUrl} />
      </div>

      <div className="card space-y-2">
        <h2 className="font-semibold">✈️ Telegram</h2>
        {profile.telegram_chat_id ? (
          <form action={unlinkTelegram} className="flex items-center gap-3 text-sm">
            <span className="text-green-700">დაკავშირებულია</span>
            <button className="text-red-600 hover:underline">გათიშვა</button>
          </form>
        ) : bot ? (
          <a className="btn-secondary" href={`https://t.me/${bot}?start=${profile.telegram_link_token}`} target="_blank" rel="noreferrer">
            Telegram-თან დაკავშირება
          </a>
        ) : (
          <p className="text-sm text-gray-500">Telegram ბოტი ჯერ არ არის ჩართული.</p>
        )}
      </div>

      <form action={changePassword} className="card space-y-2">
        <h2 className="font-semibold">პაროლის შეცვლა</h2>
        <input name="password" type="password" minLength={8} className="input" placeholder="ახალი პაროლი (მინ. 8)" autoComplete="new-password" />
        <button className="btn-secondary">შეცვლა</button>
      </form>
    </div>
  );
}
