import { getCurrentUser } from "@/lib/auth";

type Place = { latLng: { latitude: number; longitude: number } } | { address: string };

function fromCoords(s: string): Place | null {
  const m = s.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  return m ? { latLng: { latitude: Number(m[1]), longitude: Number(m[2]) } } : null;
}

// Pull a destination out of a Google Maps link (short links are followed).
async function placeFromMapUrl(raw: string): Promise<Place | null> {
  let url = raw.trim();
  if (!/^https?:\/\//.test(url)) return fromCoords(url);
  try {
    if (/goo\.gl|maps\.app/.test(url)) {
      const res = await fetch(url, { redirect: "follow" });
      url = res.url;
    }
    const u = new URL(url);
    const pin = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (pin) return { latLng: { latitude: Number(pin[1]), longitude: Number(pin[2]) } };
    for (const k of ["q", "query", "destination", "daddr", "ll"]) {
      const v = u.searchParams.get(k);
      if (v) return fromCoords(v) ?? { address: v };
    }
    const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (at) return { latLng: { latitude: Number(at[1]), longitude: Number(at[2]) } };
    const place = u.pathname.match(/\/place\/([^/]+)/);
    if (place) return { address: decodeURIComponent(place[1].replace(/\+/g, " ")) };
  } catch {
    // fall through
  }
  return null;
}

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const originRaw = process.env.PRESS_CENTER_ORIGIN;
  if (!key || !originRaw) {
    return Response.json({ error: "Google Maps არ არის ჩართული, ჩაწერეთ ხელით" }, { status: 400 });
  }
  const sp = new URL(req.url).searchParams;
  const mapUrl = sp.get("map_url") ?? "";
  const location = sp.get("location") ?? "";
  const destination =
    (mapUrl && (await placeFromMapUrl(mapUrl))) || (location ? { address: `${location}, საქართველო` } : null);
  if (!destination) return Response.json({ error: "მიუთითეთ რუკის ბმული ან ადგილი" }, { status: 400 });
  const origin = fromCoords(originRaw) ?? { address: originRaw };

  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
    },
    body: JSON.stringify({ origin, destination, travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE" }),
  });
  const data = await res.json().catch(() => null);
  const route = data?.routes?.[0];
  if (!res.ok || !route?.duration) {
    return Response.json({ error: "მარშრუტი ვერ მოიძებნა, ჩაწერეთ ხელით" }, { status: 400 });
  }
  const seconds = Number(String(route.duration).replace("s", ""));
  return Response.json({
    minutes: Math.ceil(seconds / 60 / 5) * 5,
    distance_km: route.distanceMeters ? Math.round(route.distanceMeters / 100) / 10 : null,
  });
}
