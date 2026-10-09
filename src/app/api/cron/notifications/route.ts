import { processNotifications } from "@/lib/notify";

// Retries notifications that failed to send. Call every minute with
// "Authorization: Bearer $CRON_SECRET" (the docker-compose cron service does this).
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("forbidden", { status: 403 });
  }
  const result = await processNotifications();
  return Response.json(result);
}
