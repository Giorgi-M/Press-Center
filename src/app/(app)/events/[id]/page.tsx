import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getEvent, photoUrl } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, fmtDuration, fmtTime } from "@/lib/time";
import { STATUS_LABEL } from "@/lib/types";
import { deleteEvent, setEventStatus } from "../actions";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser();
  const db = await createClient();
  const event = await getEvent(db, id);
  if (!event) notFound();
  const photo = await photoUrl(db, event.location_photo_path);
  const canEdit = me.can("events.edit_all") || (event.created_by === me.profile.id && me.can("events.create"));
  const leave = new Date(new Date(event.starts_at).getTime() - event.travel_minutes * 60_000);
  const mine = event.assignments.find((a) => a.profile_id === me.profile.id);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">← განრიგი</Link>
      <div className="card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className={`text-xl font-semibold ${event.status === "cancelled" ? "line-through text-gray-400" : ""}`}>
              {event.title}
            </h1>
            <p className="text-gray-600">
              {fmtDate(event.starts_at)} · {fmtTime(event.starts_at)}–{fmtTime(event.ends_at)} ({fmtDuration(event.duration_minutes)})
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              event.status === "cancelled" ? "bg-red-100 text-red-700" : event.status === "done" ? "bg-gray-100 text-gray-600" : "bg-green-100 text-green-700"
            }`}
          >
            {STATUS_LABEL[event.status]}
          </span>
        </div>

        {mine && (
          <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
            თქვენ ამ გადაღებაზე ხართ{mine.role ? ` როგორც ${mine.role.name}` : ""}.
            {event.travel_minutes > 0 && ` გასვლა დაახლოებით ${fmtTime(leave)}-ზე.`}
          </p>
        )}

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {event.location_name && (
            <div>
              <dt className="text-gray-500">📍 ადგილი</dt>
              <dd>{event.location_name}</dd>
            </div>
          )}
          {event.map_url && (
            <div>
              <dt className="text-gray-500">🗺 რუკა</dt>
              <dd><a href={event.map_url} target="_blank" rel="noreferrer" className="text-blue-700 underline">გახსნა რუკაზე</a></dd>
            </div>
          )}
          {event.travel_minutes > 0 && (
            <div>
              <dt className="text-gray-500">🚗 გზაში</dt>
              <dd>~{fmtDuration(event.travel_minutes)} (გასვლა {fmtTime(leave)})</dd>
            </div>
          )}
          {event.contact_name && (
            <div>
              <dt className="text-gray-500">☎️ საკონტაქტო პირი</dt>
              <dd>
                {event.contact_name}
                {event.contact_phone && (
                  <> · <a href={`tel:${event.contact_phone}`} className="text-blue-700">{event.contact_phone}</a></>
                )}
              </dd>
            </div>
          )}
        </dl>

        {event.description && <p className="whitespace-pre-wrap text-sm">{event.description}</p>}

        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="ლოკაცია" className="max-h-96 w-full rounded-lg object-cover" />
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">გუნდი</h2>
        {event.assignments.length === 0 ? (
          <p className="text-sm text-gray-500">ჯერ არავინაა დანიშნული.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {event.assignments.map((a) => (
              <li key={a.id} className="flex justify-between py-2">
                <span>{a.profile?.full_name}</span>
                <span className="text-gray-500">
                  {a.role?.name}
                  {a.profile?.phone && (
                    <> · <a href={`tel:${a.profile.phone}`} className="text-blue-700">{a.profile.phone}</a></>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Link href={`/events/${event.id}/edit`} className="btn-primary">რედაქტირება</Link>
          {event.status === "planned" && (
            <>
              <form action={setEventStatus.bind(null, event.id, "done")}>
                <button className="btn-secondary">დასრულებულად მონიშვნა</button>
              </form>
              <form action={setEventStatus.bind(null, event.id, "cancelled")}>
                <button className="btn-secondary text-red-700">გაუქმება</button>
              </form>
            </>
          )}
          {event.status !== "planned" && (
            <form action={setEventStatus.bind(null, event.id, "planned")}>
              <button className="btn-secondary">აღდგენა</button>
            </form>
          )}
          {me.can("events.edit_all") && (
            <form action={deleteEvent.bind(null, event.id)}>
              <button className="btn-danger">წაშლა</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
