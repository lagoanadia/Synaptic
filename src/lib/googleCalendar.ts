import { prisma } from "@/lib/prisma";
import { APP_TZ, addDays } from "@/lib/calendar";

// Same Google OAuth client as sign-in, separate consent (like Classroom).
// Needs the Google Calendar API enabled and these scopes on the consent
// screen of the Google Cloud project.
const SCOPES = ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.calendarlist.readonly"];
const API = "https://www.googleapis.com/calendar/v3";

const redirectUri = (baseUrl: string) => `${baseUrl}/api/google-calendar/callback`;

export function buildCalendarAuthUrl(baseUrl: string): string {
  const params = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID ?? "",
    redirect_uri: redirectUri(baseUrl),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.AUTH_GOOGLE_ID ?? "", client_secret: process.env.AUTH_GOOGLE_SECRET ?? "", ...body }),
  });
  if (!res.ok) throw new Error(`Google token request failed: ${await res.text()}`);
  return res.json();
}

export const exchangeCalendarCode = (baseUrl: string, code: string) =>
  tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri(baseUrl) });

// Refreshed lazily; a revoked token drops the connection so the UI offers
// to connect again.
export async function calendarToken(userId: string): Promise<string | null> {
  const c = await prisma.googleCalendarConnection.findUnique({ where: { userId } });
  if (!c) return null;
  if (c.expiresAt > new Date(Date.now() + 60_000)) return c.accessToken;
  try {
    const r = await tokenRequest({ refresh_token: c.refreshToken, grant_type: "refresh_token" });
    await prisma.googleCalendarConnection.update({
      where: { userId },
      data: { accessToken: r.access_token, expiresAt: new Date(Date.now() + r.expires_in * 1000) },
    });
    return r.access_token;
  } catch {
    await prisma.googleCalendarConnection.deleteMany({ where: { userId } });
    return null;
  }
}

export type GoogleCalendar = { id: string; name: string; color: string; primary: boolean };

export async function listCalendars(token: string): Promise<GoogleCalendar[]> {
  const res = await fetch(`${API}/users/me/calendarList?minAccessRole=reader`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: { id: string; summary: string; backgroundColor?: string; primary?: boolean }[] };
  return (data.items ?? []).map((c) => ({ id: c.id, name: c.summary, color: c.backgroundColor ?? "#4285f4", primary: !!c.primary }));
}

export type GoogleEvent = { id: string; title: string; start: Date; allDay: boolean; dayKey?: string; calendarColor: string };

// Events between two days (inclusive), from each chosen calendar; our own
// copies (ids starting "s…" that we wrote) are skipped so nothing shows twice.
export async function listEvents(token: string, calendars: { id: string; color: string }[], fromKey: string, toKey: string): Promise<GoogleEvent[]> {
  const params = new URLSearchParams({
    timeMin: `${fromKey}T00:00:00Z`,
    timeMax: `${addDays(toKey, 1)}T00:00:00Z`,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
    timeZone: APP_TZ,
  });
  const lists = await Promise.all(
    calendars.map(async (cal) => {
      const res = await fetch(`${API}/calendars/${encodeURIComponent(cal.id)}/events?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return [];
      const data = (await res.json()) as {
        items?: { id: string; summary?: string; status?: string; start?: { date?: string; dateTime?: string }; extendedProperties?: { private?: { synaptic?: string } } }[];
      };
      return (data.items ?? [])
        .filter((e) => e.status !== "cancelled" && !e.extendedProperties?.private?.synaptic && (e.start?.date || e.start?.dateTime))
        .map((e) => ({
          id: e.id,
          title: e.summary ?? "(sin título)",
          start: new Date(e.start!.dateTime ?? `${e.start!.date}T12:00:00Z`),
          allDay: !e.start!.dateTime,
          dayKey: e.start!.date,
          calendarColor: cal.color,
        }));
    }),
  );
  return lists.flat();
}

export type OutgoingEvent = { id: string; title: string; day: string; time?: { start: string; minutes: number } | null; description?: string };

// Creates or updates our copy in the primary calendar (fixed id, so it's
// idempotent). Marked private "synaptic" so reading never shows it twice.
export async function putEvent(token: string, e: OutgoingEvent): Promise<boolean> {
  const when = e.time
    ? (() => {
        const start = `${e.day}T${e.time.start}:00`;
        const [h, m] = e.time.start.split(":").map(Number);
        const end = new Date(Date.UTC(2000, 0, 1, h, m + e.time.minutes));
        const endKey = end.getUTCDate() > 1 ? addDays(e.day, 1) : e.day;
        return {
          start: { dateTime: start, timeZone: APP_TZ },
          end: { dateTime: `${endKey}T${String(end.getUTCHours()).padStart(2, "0")}:${String(end.getUTCMinutes()).padStart(2, "0")}:00`, timeZone: APP_TZ },
        };
      })()
    : { start: { date: e.day }, end: { date: addDays(e.day, 1) } };
  const body = JSON.stringify({ id: e.id, summary: e.title, description: e.description, ...when, extendedProperties: { private: { synaptic: "1" } } });
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const update = await fetch(`${API}/calendars/primary/events/${e.id}`, { method: "PUT", headers, body });
  if (update.ok) return true;
  if (update.status !== 404) return false;
  const insert = await fetch(`${API}/calendars/primary/events`, { method: "POST", headers, body });
  return insert.ok;
}

export async function deleteEvent(token: string, id: string): Promise<void> {
  await fetch(`${API}/calendars/primary/events/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
}
