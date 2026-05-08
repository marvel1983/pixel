import { uuidV4 } from "../uuid";

const STORAGE_KEY = "pixelcodes_session";
const COOKIE_NAME = "pixelcodes_session";
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const COOKIE_DAYS = 30;

interface StoredSession {
  id: string;
  lastSeenAt: number;
}

function readStored(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (typeof parsed.id !== "string" || typeof parsed.lastSeenAt !== "number") return null;
    return { id: parsed.id, lastSeenAt: parsed.lastSeenAt };
  } catch {
    return null;
  }
}

function writeStored(session: StoredSession) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // localStorage quota / private mode — fall through to cookie only
  }
}

function writeCookie(id: string) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + COOKIE_DAYS * 86400_000).toUTCString();
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(id)};expires=${expires};path=/;SameSite=Lax`;
}

function isIdle(session: StoredSession): boolean {
  return Date.now() - session.lastSeenAt > IDLE_TIMEOUT_MS;
}

export function getSessionId(): string {
  const existing = readStored();
  if (existing && !isIdle(existing)) {
    return existing.id;
  }
  const id = uuidV4();
  const session = { id, lastSeenAt: Date.now() };
  writeStored(session);
  writeCookie(id);
  return id;
}

export function touchSession(): void {
  const existing = readStored();
  if (!existing || isIdle(existing)) {
    getSessionId();
    return;
  }
  writeStored({ id: existing.id, lastSeenAt: Date.now() });
  writeCookie(existing.id);
}

export const __testing = { STORAGE_KEY, COOKIE_NAME, IDLE_TIMEOUT_MS };
