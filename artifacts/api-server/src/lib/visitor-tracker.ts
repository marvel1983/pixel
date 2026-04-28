interface Visitor {
  sessionId: string;
  path: string;
  referrer: string;
  userAgent: string;
  ip: string;
  lastSeen: number;
  firstSeen: number;
}

const visitors = new Map<string, Visitor>();
const TTL = 3 * 60 * 1000; // 3 minutes inactive = gone

export function upsertVisitor(sessionId: string, path: string, referrer: string, userAgent: string, ip: string) {
  const existing = visitors.get(sessionId);
  visitors.set(sessionId, {
    sessionId,
    path,
    referrer,
    userAgent,
    ip,
    lastSeen: Date.now(),
    firstSeen: existing?.firstSeen ?? Date.now(),
  });
}

export function getActiveVisitors() {
  const cutoff = Date.now() - TTL;
  const active: Visitor[] = [];
  for (const [id, v] of visitors) {
    if (v.lastSeen < cutoff) { visitors.delete(id); } else { active.push(v); }
  }
  return active;
}

export function getVisitorStats() {
  const active = getActiveVisitors();
  const byPage = new Map<string, number>();
  for (const v of active) {
    byPage.set(v.path, (byPage.get(v.path) ?? 0) + 1);
  }
  const pages = [...byPage.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([path, count]) => ({ path, count }));

  return { total: active.length, pages, visitors: active.map((v) => ({
    sessionId: v.sessionId.slice(0, 8),
    path: v.path,
    referrer: v.referrer,
    device: detectDevice(v.userAgent),
    secondsOnSite: Math.round((Date.now() - v.firstSeen) / 1000),
    lastSeen: v.lastSeen,
  })) };
}

function detectDevice(ua: string): "mobile" | "tablet" | "desktop" {
  if (/Mobile|Android.*Mobile|iPhone|iPod/.test(ua)) return "mobile";
  if (/Tablet|iPad|Android(?!.*Mobile)/.test(ua)) return "tablet";
  return "desktop";
}
