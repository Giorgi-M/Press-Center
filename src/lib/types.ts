export const PERMISSIONS = {
  "events.create": "გადაღების შექმნა",
  "events.edit_all": "ნებისმიერი გადაღების რედაქტირება / გაუქმება",
  "events.view_all": "ყველა გადაღების ნახვა",
  "events.assign": "თანამშრომლების დანიშვნა",
  "users.manage": "მომხმარებლების მართვა",
  "roles.manage": "როლების და უფლებების მართვა",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export type Role = {
  id: string;
  name: string;
  is_position: boolean;
  permissions: Permission[];
  sort_order: number;
};

export type Profile = {
  id: string;
  email: string;
  username: string | null;
  full_name: string;
  role_id: string | null;
  phone: string | null;
  whatsapp: string | null;
  telegram_chat_id: string | null;
  telegram_link_token: string | null;
  ics_token: string;
  notify_email: boolean;
  notify_sms: boolean;
  notify_whatsapp: boolean;
  notify_telegram: boolean;
  active: boolean;
};

export type EventStatus = "planned" | "cancelled" | "done";

export type PressEvent = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  duration_minutes: number;
  ends_at: string;
  travel_minutes: number;
  location_name: string | null;
  map_url: string | null;
  location_photo_path: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  status: EventStatus;
  created_by: string | null;
};

export type Assignment = {
  id: string;
  event_id: string;
  profile_id: string;
  role_id: string | null;
  note: string | null;
};

export const STATUS_LABEL: Record<EventStatus, string> = {
  planned: "დაგეგმილი",
  cancelled: "გაუქმებული",
  done: "დასრულებული",
};
