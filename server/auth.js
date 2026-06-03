import crypto from "node:crypto";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ALLOWED_DOMAIN,
  DEFAULT_PASSWORD,
} from "../src/utils/authStorage.js";
import { dbGet, dbRun, persistDb } from "./db.js";

export function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

export function isAllowedEmail(email) {
  const normalized = normalizeEmail(email);
  return normalized.endsWith(`@${ALLOWED_DOMAIN}`);
}

export function parseCookies(header) {
  const out = {};
  const raw = String(header ?? "");
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") || "");
  }
  return out;
}

export function makeSessionCookie(sid) {
  // Internal network, minimal security for now.
  return `sid=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax`;
}

export function clearSessionCookie() {
  return "sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

export async function createSession(db, email) {
  const sid = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await dbRun(db, "INSERT INTO sessions (sid, email, created_at) VALUES (?, ?, ?)", [
    sid,
    email,
    createdAt,
  ]);
  persistDb(db);
  return sid;
}

export async function deleteSession(db, sid) {
  await dbRun(db, "DELETE FROM sessions WHERE sid = ?", [sid]);
  persistDb(db);
}

export async function getUserBySid(db, sid) {
  if (!sid) return null;
  const s = await dbGet(db, "SELECT sid, email FROM sessions WHERE sid = ?", [sid]);
  if (!s?.email) return null;
  const u = await dbGet(db, "SELECT email, role, nick, created_at FROM users WHERE email = ?", [
    s.email,
  ]);
  return u ? { email: u.email, role: u.role, nick: u.nick ?? null, createdAt: u.created_at } : null;
}

export async function upsertUser(db, email, nick = null) {
  const normalized = normalizeEmail(email);
  const existing = await dbGet(
    db,
    "SELECT email, role, nick, created_at FROM users WHERE email = ?",
    [normalized],
  );
  if (existing) {
    return {
      status: "existing",
      user: {
        email: existing.email,
        role: existing.role,
        nick: existing.nick ?? null,
        createdAt: existing.created_at,
      },
    };
  }
  const role = normalized === ADMIN_EMAIL ? "admin" : "user";
  const createdAt = new Date().toISOString();
  const safeNick = String(nick ?? "").trim() || null;
  await dbRun(db, "INSERT INTO users (email, role, nick, created_at) VALUES (?, ?, ?, ?)", [
    normalized,
    role,
    safeNick,
    createdAt,
  ]);
  persistDb(db);
  return { status: "created", user: { email: normalized, role, nick: safeNick, createdAt } };
}

export function verifyPassword(email, password) {
  const normalized = normalizeEmail(email);
  if (normalized === ADMIN_EMAIL) return String(password) === ADMIN_PASSWORD;
  return String(password) === DEFAULT_PASSWORD;
}
