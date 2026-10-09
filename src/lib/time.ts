// All times are shown and entered in Tbilisi time (UTC+4, no DST).
export const TZ = "Asia/Tbilisi";
const OFFSET = "+04:00";

const MONTHS = [
  "იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი",
  "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი",
];
const WEEKDAYS = ["კვირა", "ორშაბათი", "სამშაბათი", "ოთხშაბათი", "ხუთშაბათი", "პარასკევი", "შაბათი"];

function parts(d: Date) {
  // Shift to Tbilisi wall-clock and read UTC fields.
  const t = new Date(d.getTime() + 4 * 3600_000);
  return {
    y: t.getUTCFullYear(),
    m: t.getUTCMonth(),
    d: t.getUTCDate(),
    wd: t.getUTCDay(),
    h: t.getUTCHours(),
    min: t.getUTCMinutes(),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function fmtTime(iso: string | Date) {
  const p = parts(new Date(iso));
  return `${pad(p.h)}:${pad(p.min)}`;
}

export function fmtDate(iso: string | Date) {
  const p = parts(new Date(iso));
  return `${p.d} ${MONTHS[p.m]}, ${WEEKDAYS[p.wd]}`;
}

export function fmtDateTime(iso: string | Date) {
  return `${fmtDate(iso)} ${fmtTime(iso)}`;
}

// "YYYY-MM-DD" of the Tbilisi day containing this instant.
export function dayKey(iso: string | Date) {
  const p = parts(new Date(iso));
  return `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`;
}

// Value for <input type="datetime-local"> in Tbilisi time.
export function toLocalInput(iso: string | Date) {
  const p = parts(new Date(iso));
  return `${p.y}-${pad(p.m + 1)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}`;
}

// Parse <input type="datetime-local"> (Tbilisi wall clock) into an ISO instant.
export function fromLocalInput(v: string) {
  return new Date(`${v}${v.length === 16 ? ":00" : ""}${OFFSET}`).toISOString();
}

// Start of the Tbilisi day "YYYY-MM-DD" as an instant.
export function dayStart(key: string) {
  return new Date(`${key}T00:00:00${OFFSET}`);
}

export function addDays(key: string, n: number) {
  const d = dayStart(key);
  return dayKey(new Date(d.getTime() + n * 86400_000));
}

export function todayKey() {
  return dayKey(new Date());
}

export function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m} წთ`;
  return m ? `${h} სთ ${m} წთ` : `${h} სთ`;
}
