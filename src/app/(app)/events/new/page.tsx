import { EventForm } from "@/components/EventForm";
import { requirePerm } from "@/lib/auth";
import { loadFormOptions } from "@/lib/formData";
import { createClient } from "@/lib/supabase/server";

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const me = await requirePerm("events.create");
  const { date } = await searchParams;
  const { roles, people } = await loadFormOptions(await createClient());
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">ახალი გადაღება</h1>
      <EventForm
        initial={{ starts_at_local: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00` : "" }}
        roles={roles}
        people={people}
        canAssign={me.can("events.assign")}
      />
    </div>
  );
}
