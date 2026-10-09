import { notFound, redirect } from "next/navigation";
import { EventForm } from "@/components/EventForm";
import { requireUser } from "@/lib/auth";
import { getEvent, photoUrl } from "@/lib/events";
import { loadFormOptions } from "@/lib/formData";
import { createClient } from "@/lib/supabase/server";
import { toLocalInput } from "@/lib/time";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser();
  const db = await createClient();
  const event = await getEvent(db, id);
  if (!event) notFound();
  const canEdit = me.can("events.edit_all") || (event.created_by === me.profile.id && me.can("events.create"));
  if (!canEdit) redirect(`/events/${id}`);
  const { roles, people } = await loadFormOptions(db);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">რედაქტირება: {event.title}</h1>
      <EventForm
        initial={{
          ...event,
          starts_at_local: toLocalInput(event.starts_at),
          photo_url: await photoUrl(db, event.location_photo_path),
          assignments: event.assignments.map((a) => ({ role_id: a.role_id, profile_id: a.profile_id })),
        }}
        roles={roles}
        people={people}
        canAssign={me.can("events.assign")}
      />
    </div>
  );
}
