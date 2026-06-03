const USERS_KEY = "mundial2026_users_v1";
const SESSION_KEY = "mundial2026_session_v1";
const SESSION_SID_KEY = "mundial2026_sid_v1";

export const DEFAULT_PASSWORD = "mundial2026";
export const ADMIN_PASSWORD = "adminmundial";
export const ADMIN_EMAIL = "admin@typsa.es";
export const ALLOWED_DOMAIN = "typsa.es";

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

export function isAllowedEmail(email) {
  const normalized = normalizeEmail(email);
  return normalized.endsWith(`@${ALLOWED_DOMAIN}`);
}

export function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    const parsed = raw ? safeParse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function deleteUserByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return { ok: false, reason: "missing" };
  if (normalized === ADMIN_EMAIL) return { ok: false, reason: "admin_protected" };
  const users = loadUsers();
  const nextUsers = users.filter((u) => normalizeEmail(u.email) !== normalized);
  saveUsers(nextUsers);
  return { ok: true, users: nextUsers };
}

export function clearNonAdminUsers() {
  const users = loadUsers();
  const nextUsers = users.filter((u) => normalizeEmail(u.email) === ADMIN_EMAIL);
  saveUsers(nextUsers);
  return nextUsers;
}

export function loadSessionEmail() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const parsed = raw ? safeParse(raw) : null;
    const email = parsed?.email;
    return email ? normalizeEmail(email) : null;
  } catch {
    return null;
  }
}

export function saveSessionEmail(email) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ email: normalizeEmail(email) }));
}

export function loadSessionSid() {
  try {
    const raw = localStorage.getItem(SESSION_SID_KEY);
    const parsed = raw ? safeParse(raw) : null;
    const sid = parsed?.sid;
    return sid ? String(sid) : null;
  } catch {
    return null;
  }
}

export function saveSessionSid(sid) {
  if (!sid) return;
  localStorage.setItem(SESSION_SID_KEY, JSON.stringify({ sid: String(sid) }));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_SID_KEY);
}

export function upsertUserByEmail(email) {
  const normalized = normalizeEmail(email);
  const users = loadUsers();
  const existing = users.find((u) => normalizeEmail(u.email) === normalized);
  if (existing) return { status: "existing", user: existing, users };

  const nextUser = {
    email: normalized,
    role: normalized === ADMIN_EMAIL ? "admin" : "user",
    createdAt: new Date().toISOString(),
  };
  const nextUsers = [...users, nextUser].sort((a, b) => a.email.localeCompare(b.email));
  saveUsers(nextUsers);
  return { status: "created", user: nextUser, users: nextUsers };
}
