import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listEvents } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import { addDays, dayKey, dayStart, fmtDate, fmtTime, todayKey } from "@/lib/time";

function mondayOf(key: string) {
  const wd = new Date(`${key}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(key, wd === 0 ? -6 : 1 - wd);
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; mine?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const me = await requireUser();
  const db = await createClient();

  const today = todayKey();
  const week = mondayOf(sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? sp.week : today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const showAll = me.can("events.view_all");
  const mineOnly = !showAll || sp.mine === "1";

  let events = await listEvents(db, dayStart(week), dayStart(addDays(week, 7)));
  if (mineOnly) events = events.filter((e) => e.assignments.some((a) => a.profile_id === me.profile.id));

  const byDay = new Map<string, typeof events>();
  for (const e of events) byDay.set(dayKey(e.starts_at), [...(byDay.get(dayKey(e.starts_at)) ?? []), e]);

  const q = (params: Record<string, string | undefined>) => {
    const s = new URLSearchParams();
    const merged = { week, mine: sp.mine, ...params };
    for (const [k, v] of Object.entries(merged)) if (v) s.set(k, v);
    return `/?${s}`;
  };

  return (
    <div className="space-y-4">
      {sp.error === "forbidden" && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">ამ გვერდზე წვდომის უფლება არ გაქვთ.</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={q({ week: addDays(week, -7) })} className="btn-secondary px-3">←</Link>
          <Link href={q({ week: today })} className="btn-secondary">დღეს</Link>
          <Link href={q({ week: addDays(week, 7) })} className="btn-secondary px-3">→</Link>
          <h1 className="ml-2 font-semibold">
            {fmtDate(dayStart(week)).split(",")[0]} – {fmtDate(dayStart(addDays(week, 6))).split(",")[0]}
          </h1>
        </div>
        {showAll && (
          <div className="flex rounded-lg border border-gray-300 bg-white p-0.5 text-sm">
            <Link href={q({ mine: undefined })} className={`rounded-md px-3 py-1 ${!mineOnly ? "bg-blue-700 text-white" : ""}`}>ყველა</Link>
            <Link href={q({ mine: "1" })} className={`rounded-md px-3 py-1 ${mineOnly ? "bg-blue-700 text-white" : ""}`}>ჩემი</Link>
          </div>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-7">
        {days.map((d) => {
          const list = byDay.get(d) ?? [];
          const isToday = d === today;
          return (
            <section key={d} className={`rounded-xl border bg-white p-3 ${isToday ? "border-blue-500 ring-1 ring-blue-200" : "border-gray-200"}`}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className={`text-sm font-medium ${isToday ? "text-blue-700" : "text-gray-700"}`}>{fmtDate(dayStart(d))}</h2>
                {me.can("events.create") && (
                  <Link href={`/events/new?date=${d}`} className="text-lg leading-none text-gray-400 hover:text-blue-700" title="გადაღების დამატება">+</Link>
                )}
              </div>
              {list.length === 0 && <p className="text-xs text-gray-400">გადაღება არ არის</p>}
              <div className="space-y-2">
                {list.map((e) => (
                  <Link
                    key={e.id}
                    href={`/events/${e.id}`}
                    className={`block rounded-lg border p-2 text-sm hover:border-blue-400 ${
                      e.status === "cancelled" ? "border-red-200 bg-red-50 opacity-70" : e.status === "done" ? "border-gray-200 bg-gray-50" : "border-blue-100 bg-blue-50/50"
                    }`}
                  >
                    <div className="font-medium">
                      {fmtTime(e.starts_at)}–{fmtTime(e.ends_at)}
                      {e.status === "cancelled" && <span className="ml-1 text-xs text-red-600">გაუქმდა</span>}
                    </div>
                    <div className={e.status === "cancelled" ? "line-through" : ""}>{e.title}</div>
                    {e.location_name && <div className="text-xs text-gray-500">📍 {e.location_name}</div>}
                    {e.assignments.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {e.assignments.map((a) => (
                          <span
                            key={a.id}
                            className={`rounded px-1.5 py-0.5 text-[11px] ${a.profile_id === me.profile.id ? "bg-blue-700 text-white" : "bg-white text-gray-700 ring-1 ring-gray-200"}`}
                            title={a.role?.name}
                          >
                            {a.profile?.full_name}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
