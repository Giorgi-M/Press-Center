"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { checkConflicts, saveEvent, type Conflict } from "@/app/(app)/events/actions";
import { fmtTime } from "@/lib/time";

type RoleOpt = { id: string; name: string; is_position: boolean };
type PersonOpt = { id: string; full_name: string; role_id: string | null };
type Row = { key: number; role_id: string | null; profile_id: string };

export type EventFormInitial = {
  id?: string;
  title?: string;
  description?: string | null;
  starts_at_local?: string;
  duration_minutes?: number;
  travel_minutes?: number;
  location_name?: string | null;
  map_url?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  photo_url?: string | null;
  assignments?: { role_id: string | null; profile_id: string }[];
};

const DURATIONS = [30, 60, 90, 120, 180, 240, 360, 480];

let nextKey = 1;

export function EventForm({
  initial,
  roles,
  people,
  canAssign,
}: {
  initial: EventFormInitial;
  roles: RoleOpt[];
  people: PersonOpt[];
  canAssign: boolean;
}) {
  const [state, action, pending] = useActionState(saveEvent, null);
  const [start, setStart] = useState(initial.starts_at_local ?? "");
  const [duration, setDuration] = useState(initial.duration_minutes ?? 60);
  const [travel, setTravel] = useState(initial.travel_minutes ?? 0);
  const [mapUrl, setMapUrl] = useState(initial.map_url ?? "");
  const [location, setLocation] = useState(initial.location_name ?? "");
  const [rows, setRows] = useState<Row[]>(
    (initial.assignments ?? []).map((a) => ({ key: nextKey++, ...a })),
  );
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [travelMsg, setTravelMsg] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);

  const positions = roles.filter((r) => r.is_position);
  const roleName = useMemo(() => new Map(roles.map((r) => [r.id, r.name])), [roles]);

  // Re-check who is busy whenever the time window changes.
  useEffect(() => {
    if (!start || !duration) return;
    const t = setTimeout(() => {
      checkConflicts(start, duration, travel, initial.id ?? null).then(setConflicts).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [start, duration, travel, initial.id]);

  const busy = useMemo(() => {
    const m = new Map<string, Conflict[]>();
    for (const c of conflicts) m.set(c.profile_id, [...(m.get(c.profile_id) ?? []), c]);
    return m;
  }, [conflicts]);

  const busyLabel = (pid: string) =>
    (busy.get(pid) ?? []).map((c) => `${c.title} ${fmtTime(c.starts_at)}–${fmtTime(c.ends_at)}`).join("; ");

  const chosen = new Set(rows.map((r) => r.profile_id).filter(Boolean));

  async function calcTravel() {
    setTravelMsg("ითვლება...");
    const qs = new URLSearchParams({ map_url: mapUrl, location });
    const res = await fetch(`/api/travel-time?${qs}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && typeof data.minutes === "number") {
      setTravel(data.minutes);
      setTravelMsg(`Google Maps: ~${data.minutes} წთ${data.distance_km ? `, ${data.distance_km} კმ` : ""}`);
    } else {
      setTravelMsg(data.error ?? "ვერ გამოითვალა, ჩაწერეთ ხელით");
    }
  }

  return (
    <form action={action} className="space-y-6">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input
        type="hidden"
        name="assignments"
        value={JSON.stringify(rows.filter((r) => r.profile_id).map(({ role_id, profile_id }) => ({ role_id, profile_id })))}
      />

      <section className="card space-y-4">
        <h2 className="font-semibold">ძირითადი ინფორმაცია</h2>
        <div>
          <label className="label">სათაური *</label>
          <input name="title" className="input" defaultValue={initial.title} required placeholder="მაგ. გამგებლის შეხვედრა მოსახლეობასთან" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">დაწყება *</label>
            <input type="datetime-local" name="starts_at" className="input" value={start} onChange={(e) => setStart(e.target.value)} required />
          </div>
          <div>
            <label className="label">ხანგრძლივობა (წთ) *</label>
            <input
              type="number"
              name="duration_minutes"
              min={5}
              step={5}
              className="input"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              list="durations"
              required
            />
            <datalist id="durations">
              {DURATIONS.map((d) => <option key={d} value={d} />)}
            </datalist>
          </div>
          <div>
            <label className="label">გზაში (წთ, ცალი მხარე)</label>
            <div className="flex gap-2">
              <input type="number" name="travel_minutes" min={0} className="input" value={travel} onChange={(e) => setTravel(Number(e.target.value))} />
              <button type="button" className="btn-secondary shrink-0 px-3" onClick={calcTravel} title="Google Maps-ით გამოთვლა">
                🗺
              </button>
            </div>
            {travelMsg && <p className="mt-1 text-xs text-gray-500">{travelMsg}</p>}
          </div>
        </div>
        <div>
          <label className="label">აღწერა</label>
          <textarea name="description" className="input min-h-20" defaultValue={initial.description ?? ""} />
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">ლოკაცია</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">ადგილი</label>
            <input name="location_name" className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="მაგ. ლილო, ახალი სკოლა" />
          </div>
          <div>
            <label className="label">რუკის ბმული</label>
            <input name="map_url" className="input" value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} placeholder="https://maps.app.goo.gl/..." />
          </div>
        </div>
        <div>
          <label className="label">ლოკაციის ფოტო</label>
          {initial.photo_url && !removePhoto && (
            <div className="mb-2 flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={initial.photo_url} alt="" className="h-24 rounded-lg object-cover" />
              <button type="button" className="text-sm text-red-600" onClick={() => setRemovePhoto(true)}>წაშლა</button>
            </div>
          )}
          {removePhoto && <input type="hidden" name="remove_photo" value="1" />}
          <input type="file" name="photo" accept="image/*" className="text-sm" />
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">საკონტაქტო პირი (PR)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">სახელი</label>
            <input name="contact_name" className="input" defaultValue={initial.contact_name ?? ""} />
          </div>
          <div>
            <label className="label">ტელეფონი</label>
            <input name="contact_phone" className="input" defaultValue={initial.contact_phone ?? ""} inputMode="tel" />
          </div>
        </div>
      </section>

      {canAssign && (
        <section className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">გუნდი</h2>
            <div className="flex flex-wrap gap-1">
              {positions.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="rounded-full border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50"
                  onClick={() => setRows([...rows, { key: nextKey++, role_id: r.id, profile_id: "" }])}
                >
                  + {r.name}
                </button>
              ))}
            </div>
          </div>
          {!rows.length && <p className="text-sm text-gray-500">ჯერ არავინაა დანიშნული. დაამატეთ პოზიცია ზემოთ.</p>}
          <div className="space-y-2">
            {rows.map((row, i) => {
              const own = people.filter((p) => p.role_id === row.role_id);
              const others = people.filter((p) => p.role_id !== row.role_id);
              const option = (p: PersonOpt) => {
                const b = busyLabel(p.id);
                return (
                  <option key={p.id} value={p.id} disabled={chosen.has(p.id) && p.id !== row.profile_id}>
                    {b ? "⚠ " : ""}
                    {p.full_name}
                    {p.role_id !== row.role_id && p.role_id ? ` (${roleName.get(p.role_id)})` : ""}
                    {b ? ` — დაკავებულია: ${b}` : ""}
                  </option>
                );
              };
              const warn = row.profile_id && busyLabel(row.profile_id);
              return (
                <div key={row.key} className="rounded-lg border border-gray-200 p-2">
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="input w-auto"
                      value={row.role_id ?? ""}
                      onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, role_id: e.target.value || null } : r)))}
                    >
                      <option value="">პოზიცია</option>
                      {positions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <select
                      className="input min-w-48 flex-1"
                      value={row.profile_id}
                      onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, profile_id: e.target.value } : r)))}
                    >
                      <option value="">— აირჩიეთ —</option>
                      {own.length > 0 && <optgroup label={roleName.get(row.role_id ?? "") ?? ""}>{own.map(option)}</optgroup>}
                      <optgroup label="სხვები">{others.map(option)}</optgroup>
                    </select>
                    <button type="button" className="px-2 text-gray-400 hover:text-red-600" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="წაშლა">
                      ✕
                    </button>
                  </div>
                  {warn && (
                    <p className="mt-1 text-xs text-amber-700">
                      ⚠ ამ დროს უკვე დაკავებულია: {warn}. დანიშვნა მაინც შესაძლებელია.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {state?.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>{pending ? "ინახება..." : "შენახვა"}</button>
        <a href={initial.id ? `/events/${initial.id}` : "/"} className="btn-secondary">გაუქმება</a>
      </div>
    </form>
  );
}
