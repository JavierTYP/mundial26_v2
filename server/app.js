import path from "node:path";
import fs from "node:fs";
import express from "express";

import { ADMIN_EMAIL } from "../src/utils/authStorage.js";
import { createDb, dbAll, dbGet, dbRun, persistDb } from "./db.js";
import {
  clearSessionCookie,
  createSession,
  getUserBySid,
  isAllowedEmail,
  makeSessionCookie,
  normalizeEmail,
  parseCookies,
  upsertUser,
  verifyPassword,
  deleteSession,
} from "./auth.js";
import { getSupabaseAdmin } from "./supabaseAuth.js";

const initialState = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "src", "data", "mundial2026.json"), "utf8"),
);

const { db, dbPath, mode } = await createDb();
// eslint-disable-next-line no-console
console.log(`DB (${mode}): ${dbPath}`);

// Ensure the configured admin exists and is the only admin account.
{
  const createdAt = new Date().toISOString();
  await dbRun(
    db,
    "INSERT INTO users (email, role, created_at) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET role=excluded.role",
    [ADMIN_EMAIL, "admin", createdAt],
  );
  await dbRun(db, "UPDATE users SET role = 'user' WHERE role = 'admin' AND email <> ?", [
    ADMIN_EMAIL,
  ]);
  persistDb(db);
}

function jsonOrNull(raw) {
  if (raw && typeof raw === "object") return raw; // pg json/jsonb
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function migrateMatchId(rawId, { forceKo = false } = {}) {
  const id = String(rawId ?? "");
  if (!id) return null;

  // Already new format
  if (
    id.startsWith("FG-") ||
    id.startsWith("16-") ||
    id.startsWith("08-") ||
    id.startsWith("04-") ||
    id.startsWith("02-") ||
    id === "3P-31" ||
    id === "FI-F1"
  ) {
    return id;
  }

  // Legacy KO-prefixed (from previous fixes)
  if (id.startsWith("KO:")) return migrateMatchId(id.slice(3), { forceKo: true });

  // Group stage (old)
  if (!forceKo && /^[A-L][1-6]$/.test(id)) return `FG-${id}`;

  // Knockout (old)
  if (/^D\\d{1,2}$/.test(id)) return `16-${id}`;
  if (/^O\\d{1,2}$/.test(id)) return `08-${id}`;
  if (/^C\\d{1,2}$/.test(id)) return `04-${id}`;
  if (/^S\\d{1,2}$/.test(id)) return `02-${id}`;
  if (id === "3P") return "3P-31";
  if (id === "F") return "FI-F1";

  return id;
}

function migrateTournamentStateIds(state) {
  if (!state || typeof state !== "object") return state;

  const isNew =
    Object.values(state.grupos ?? {}).some((g) =>
      (g?.partidos ?? []).some((p) => String(p?.id ?? "").startsWith("FG-")),
    ) ||
    (state.dieciseisavos ?? []).some((m) => String(m?.id ?? "").startsWith("16-")) ||
    (state.octavos ?? []).some((m) => String(m?.id ?? "").startsWith("08-"));

  if (isNew) return state;

  const grupos = {};
  for (const [gid, g] of Object.entries(state.grupos ?? {})) {
    grupos[gid] = {
      ...g,
      partidos: (g?.partidos ?? []).map((p) => ({ ...p, id: migrateMatchId(p.id) })),
    };
  }

  const dieciseisavos = (state.dieciseisavos ?? []).map((m) => ({
    ...m,
    id: migrateMatchId(m.id),
  }));
  const octavos = (state.octavos ?? []).map((m) => ({
    ...m,
    id: migrateMatchId(m.id),
    emparejamiento:
      typeof m.emparejamiento === "string"
        ? m.emparejamiento.replace(/\\bD(\\d{1,2})\\b/g, (_s, n) => `16-D${n}`)
        : m.emparejamiento,
  }));
  const cuartos = (state.cuartos ?? []).map((m) => ({
    ...m,
    id: migrateMatchId(m.id),
    emparejamiento:
      typeof m.emparejamiento === "string"
        ? m.emparejamiento.replace(/\\bO(\\d{1,2})\\b/g, (_s, n) => `08-O${n}`)
        : m.emparejamiento,
  }));
  const semifinales = (state.semifinales ?? []).map((m) => ({
    ...m,
    id: migrateMatchId(m.id),
    emparejamiento:
      typeof m.emparejamiento === "string"
        ? m.emparejamiento.replace(/\\bC(\\d{1,2})\\b/g, (_s, n) => `04-C${n}`)
        : m.emparejamiento,
  }));
  const final = state.final
    ? {
        ...state.final,
        id: migrateMatchId(state.final.id),
        emparejamiento:
          typeof state.final.emparejamiento === "string"
            ? state.final.emparejamiento.replace(/\\bS(\\d{1,2})\\b/g, (_s, n) => `02-S${n}`)
            : state.final.emparejamiento,
      }
    : state.final;

  return { ...state, grupos, dieciseisavos, octavos, cuartos, semifinales, final };
}

async function getPredictionsLocked() {
  const row = await dbGet(db, "SELECT value FROM settings WHERE key = ?", ["predictions_locked"]);
  return row ? row.value === "1" : false;
}

async function setPredictionsLocked(locked) {
  const v = locked ? "1" : "0";
  await dbRun(
    db,
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    ["predictions_locked", v],
  );
  persistDb(db);
}

async function getResultsLocked() {
  const row = await dbGet(db, "SELECT value FROM settings WHERE key = ?", ["results_locked"]);
  return row ? row.value === "1" : false;
}

async function setResultsLocked(locked) {
  const v = locked ? "1" : "0";
  await dbRun(
    db,
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    ["results_locked", v],
  );
  persistDb(db);
}

async function getTournamentState() {
  const row = await dbGet(db, "SELECT json, updated_at FROM tournament_state WHERE id = 1", []);
  if (!row?.json) return { state: initialState, updatedAt: null };
  const parsed = jsonOrNull(row.json);
  return { state: parsed ?? initialState, updatedAt: row.updated_at ?? null };
}

async function putTournamentState(state) {
  const json = JSON.stringify(state);
  const updatedAt = new Date().toISOString();
  await dbRun(
    db,
    "INSERT INTO tournament_state (id, json, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at",
    [json, updatedAt],
  );
  persistDb(db);
  return updatedAt;
}

// seed initial state if missing
if (!(await dbGet(db, "SELECT id FROM tournament_state WHERE id = 1", []))) {
  await putTournamentState(initialState);
}
if (!(await dbGet(db, "SELECT key FROM settings WHERE key = ?", ["predictions_locked"]))) {
  await setPredictionsLocked(false);
}
if (!(await dbGet(db, "SELECT key FROM settings WHERE key = ?", ["results_locked"]))) {
  await setResultsLocked(false);
}

// Migrate stored tournament state + predictions to the new unique match id scheme.
{
  const row = await dbGet(db, "SELECT json, updated_at FROM tournament_state WHERE id = 1", []);
  const parsed = row?.json ? jsonOrNull(row.json) : null;
  const migrated = migrateTournamentStateIds(parsed);
  if (migrated && migrated !== parsed) {
    await putTournamentState(migrated);
  }

  const rows = await dbAll(
    db,
    "SELECT email, match_id, local, visitante, winner, updated_at FROM predictions",
    [],
  );
  for (const r of rows) {
    const oldId = String(r.match_id ?? "");
    const newId = migrateMatchId(oldId);
    if (!newId || newId === oldId) continue;

    const existing = await dbGet(
      db,
      "SELECT local, visitante, winner, updated_at FROM predictions WHERE email = ? AND match_id = ?",
      [r.email, newId],
    );

    const shouldOverwrite =
      !existing || String(r.updated_at ?? "") > String(existing.updated_at ?? "");
    if (shouldOverwrite) {
      await dbRun(
        db,
        "INSERT INTO predictions (email, match_id, local, visitante, winner, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(email, match_id) DO UPDATE SET local=excluded.local, visitante=excluded.visitante, winner=excluded.winner, updated_at=excluded.updated_at",
        [r.email, newId, r.local, r.visitante, r.winner ?? null, r.updated_at],
      );
    }

    await dbRun(db, "DELETE FROM predictions WHERE email = ? AND match_id = ?", [r.email, oldId]);
  }

  persistDb(db);
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", async (_req, res) => {
  try {
    const row = await dbGet(db, "SELECT 1 as ok", []);
    res.json({ ok: true, db: { mode }, ping: row?.ok ?? 1 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("healthcheck_failed", err);
    res.status(500).json({ ok: false, db: { mode }, error: String(err?.message ?? err) });
  }
});

app.use(async (req, _res, next) => {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies.sid || req.get("x-sid") || null;
  const user = await getUserBySid(db, sid);
  req.user = user;
  req.sid = sid;
  next();
});

function requireAuth(req, res) {
  if (req.user?.email) return true;
  res.status(401).json({ error: "unauthorized" });
  return false;
}

function requireAdmin(req, res) {
  if (!requireAuth(req, res)) return false;
  if (req.user?.role === "admin") return true;
  res.status(403).json({ error: "forbidden" });
  return false;
}

app.post("/api/login", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password ?? "");
  const nick = req.body?.nick ?? null;
  const safeNick = String(nick ?? "").trim() || null;

  if (!email || !isAllowedEmail(email)) {
    res.status(400).json({ error: "invalid_email" });
    return;
  }
  if (!verifyPassword(email, password)) {
    res.status(400).json({ error: "invalid_password" });
    return;
  }

  let existing = await dbGet(db, "SELECT email, role, nick, created_at FROM users WHERE email = ?", [
    email,
  ]);

  // If user doesn't exist, only allow creation when nick is provided (UI "register" mode).
  let upsertResult = null;
  if (!existing) {
    if (!safeNick) {
      res.status(404).json({ error: "user_not_registered" });
      return;
    }
    upsertResult = await upsertUser(db, email, safeNick);
    existing = await dbGet(db, "SELECT email, role, nick, created_at FROM users WHERE email = ?", [
      email,
    ]);
  } else if (safeNick && safeNick !== (existing.nick ?? null)) {
    // Optional nick update on login (convenience).
    await dbRun(db, "UPDATE users SET nick = ? WHERE email = ?", [safeNick, email]);
    persistDb(db);
    existing = { ...existing, nick: safeNick };
  }

  const sid = await createSession(db, email);
  res.setHeader("Set-Cookie", makeSessionCookie(sid));
  res.json({
    ok: true,
    sid,
    status: upsertResult?.status ?? "existing",
    user: { email, role: existing?.role ?? "user", nick: existing?.nick ?? null },
  });
});

app.post("/api/register", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password ?? "");
  const nick = req.body?.nick ?? null;

  if (!email || !isAllowedEmail(email)) {
    res.status(400).json({ error: "invalid_email" });
    return;
  }
  if (!verifyPassword(email, password)) {
    res.status(400).json({ error: "invalid_password" });
    return;
  }

  const r = await upsertUser(db, email, nick);
  const sid = await createSession(db, email);
  res.setHeader("Set-Cookie", makeSessionCookie(sid));
  res.json({ ok: true, sid, ...r });
});

app.post("/api/logout", async (req, res) => {
  if (req.sid) await deleteSession(db, req.sid);
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.json({ ok: true });
});

app.get("/api/me", async (req, res) => {
  if (!requireAuth(req, res)) return;
  res.json({
    user: req.user,
    settings: {
      predictionsLocked: await getPredictionsLocked(),
      resultsLocked: await getResultsLocked(),
    },
  });
});

app.post("/api/login-supabase", async (req, res) => {
  const accessToken = String(req.body?.accessToken ?? "").trim();
  const nick = req.body?.nick ?? null;
  const safeNick = String(nick ?? "").trim() || null;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(500).json({ error: "supabase_not_configured" });
    return;
  }
  if (!accessToken) {
    res.status(400).json({ error: "missing_access_token" });
    return;
  }

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user?.email) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const email = normalizeEmail(data.user.email);
  if (!email || !isAllowedEmail(email)) {
    res.status(400).json({ error: "invalid_email" });
    return;
  }

  // Ensure app user exists (stores role/nick) – password stays in Supabase Auth only.
  let existing = await dbGet(db, "SELECT email, role, nick, created_at FROM users WHERE email = ?", [
    email,
  ]);

  let upsertResult = null;
  if (!existing) {
    // If user doesn't exist, only allow creation when nick is provided (UI "register" mode).
    if (!safeNick) {
      res.status(404).json({ error: "user_not_registered" });
      return;
    }
    upsertResult = await upsertUser(db, email, safeNick);
    existing = await dbGet(db, "SELECT email, role, nick, created_at FROM users WHERE email = ?", [
      email,
    ]);
  } else if (safeNick && safeNick !== (existing.nick ?? null)) {
    await dbRun(db, "UPDATE users SET nick = ? WHERE email = ?", [safeNick, email]);
    persistDb(db);
    existing = { ...existing, nick: safeNick };
  }

  // Store auth_user_id if the column exists (best-effort).
  try {
    const authUserId = data.user.id ?? null;
    if (authUserId) {
      await dbRun(db, "UPDATE users SET auth_user_id = ? WHERE email = ?", [authUserId, email]);
      persistDb(db);
    }
  } catch {
    // ignore (column may not exist in sqlite)
  }

  const sid = await createSession(db, email);
  res.setHeader("Set-Cookie", makeSessionCookie(sid));
  res.json({
    ok: true,
    sid,
    status: upsertResult?.status ?? "existing",
    user: { email, role: existing?.role ?? "user", nick: existing?.nick ?? null },
  });
});

app.get("/api/tournament-state", async (req, res) => {
  if (!requireAuth(req, res)) return;
  const { state, updatedAt } = await getTournamentState();
  res.json({
    state,
    updatedAt,
    predictionsLocked: await getPredictionsLocked(),
    resultsLocked: await getResultsLocked(),
  });
});

app.put("/api/tournament-state", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (await getResultsLocked()) {
    res.status(409).json({ error: "results_locked" });
    return;
  }
  const state = req.body?.state ?? null;
  if (!state || typeof state !== "object") {
    res.status(400).json({ error: "invalid_state" });
    return;
  }
  const updatedAt = await putTournamentState(state);
  res.json({ ok: true, updatedAt });
});

app.get("/api/predictions/me", async (req, res) => {
  if (!requireAuth(req, res)) return;
  const email = req.user.email;
  const rows = await dbAll(
    db,
    "SELECT match_id, local, visitante, winner, updated_at FROM predictions WHERE email = ?",
    [email],
  );
  const predictions = {};
  for (const r of rows) {
    predictions[r.match_id] = {
      local: r.local,
      visitante: r.visitante,
      winner: r.winner ?? null,
      updatedAt: r.updated_at,
    };
  }
  res.json({ email, predictions, predictionsLocked: await getPredictionsLocked() });
});

app.put("/api/predictions/me", async (req, res) => {
  if (!requireAuth(req, res)) return;
  if (await getPredictionsLocked()) {
    res.status(409).json({ error: "predictions_locked" });
    return;
  }

  const email = req.user.email;
  const matchId = migrateMatchId(req.body?.matchId);
  const local = req.body?.local === "" || req.body?.local == null ? null : Number.parseInt(req.body.local, 10);
  const visitante =
    req.body?.visitante === "" || req.body?.visitante == null
      ? null
      : Number.parseInt(req.body.visitante, 10);
  const winnerRaw = req.body?.winner ?? null;
  const winner = winnerRaw == null || winnerRaw === "" ? null : String(winnerRaw);
  const updatedAt = new Date().toISOString();

  if (!matchId) {
    res.status(400).json({ error: "invalid_match_id" });
    return;
  }
  if (
    (local != null && (Number.isNaN(local) || local < 0 || local > 10)) ||
    (visitante != null && (Number.isNaN(visitante) || visitante < 0 || visitante > 10))
  ) {
    res.status(400).json({ error: "invalid_score" });
    return;
  }

  try {
    await dbRun(
      db,
      "INSERT INTO predictions (email, match_id, local, visitante, winner, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(email, match_id) DO UPDATE SET local=excluded.local, visitante=excluded.visitante, winner=excluded.winner, updated_at=excluded.updated_at",
      [email, matchId, local, visitante, winner, updatedAt],
    );
    persistDb(db);
    res.json({ ok: true, updatedAt });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("prediction_save_failed", {
      email,
      matchId,
      local,
      visitante,
      winner,
      error: err?.message ?? String(err),
    });
    res.status(500).json({ error: "prediction_save_failed" });
  }
});

function normalizeGoleadoresPicks(picks) {
  const base = Array.isArray(picks) ? picks : [];
  const row = base[0] ?? {};
  const team = String(row?.team ?? "").trim();
  const player = String(row?.player ?? "").trim();
  return [{ team, player }];
}

function normalizeZamoraPick(pick) {
  const row = pick && typeof pick === "object" ? pick : {};
  const team = String(row?.team ?? "").trim();
  const goalkeeper = String(row?.goalkeeper ?? "").trim();
  return { team, goalkeeper };
}

function normalizeMvpPick(pick) {
  const row = pick && typeof pick === "object" ? pick : {};
  const team = String(row?.team ?? "").trim();
  const player = String(row?.player ?? "").trim();
  return { team, player };
}

app.get("/api/goleadores/me", async (req, res) => {
  if (!requireAuth(req, res)) return;
  const email = req.user.email;
  const row = await dbGet(db, "SELECT picks_json, updated_at FROM goleadores_picks WHERE email = ?", [
    email,
  ]);
  const picksRaw = row?.picks_json ?? null;
  const picks =
    picksRaw && typeof picksRaw === "string" ? jsonOrNull(picksRaw) : picksRaw && typeof picksRaw === "object" ? picksRaw : null;
  res.json({ email, picks: normalizeGoleadoresPicks(picks), updatedAt: row?.updated_at ?? null });
});

app.put("/api/goleadores/me", async (req, res) => {
  if (!requireAuth(req, res)) return;
  if (await getPredictionsLocked()) {
    res.status(409).json({ error: "predictions_locked" });
    return;
  }
  const email = req.user.email;
  const picks = normalizeGoleadoresPicks(req.body?.picks);
  const updatedAt = new Date().toISOString();
  // Postgres treats JS arrays as PG array params; JSONB needs a JSON string.
  const picksValue = JSON.stringify(picks);
  await dbRun(
    db,
    "INSERT INTO goleadores_picks (email, picks_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET picks_json=excluded.picks_json, updated_at=excluded.updated_at",
    [email, picksValue, updatedAt],
  );
  persistDb(db);
  res.json({ ok: true, updatedAt });
});

app.get("/api/zamora/me", async (req, res) => {
  if (!requireAuth(req, res)) return;
  const email = req.user.email;
  const row = await dbGet(db, "SELECT pick_json, updated_at FROM zamora_picks WHERE email = ?", [
    email,
  ]);
  const pickRaw = row?.pick_json ?? null;
  const pick =
    pickRaw && typeof pickRaw === "string"
      ? jsonOrNull(pickRaw)
      : pickRaw && typeof pickRaw === "object"
        ? pickRaw
        : null;
  res.json({ email, pick: normalizeZamoraPick(pick), updatedAt: row?.updated_at ?? null });
});

app.put("/api/zamora/me", async (req, res) => {
  if (!requireAuth(req, res)) return;
  if (await getPredictionsLocked()) {
    res.status(409).json({ error: "predictions_locked" });
    return;
  }
  const email = req.user.email;
  const pick = normalizeZamoraPick(req.body?.pick);
  const updatedAt = new Date().toISOString();
  const pickValue = db?.__dbKind === "pg" ? pick : JSON.stringify(pick);
  await dbRun(
    db,
    "INSERT INTO zamora_picks (email, pick_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET pick_json=excluded.pick_json, updated_at=excluded.updated_at",
    [email, pickValue, updatedAt],
  );
  persistDb(db);
  res.json({ ok: true, updatedAt });
});

app.get("/api/mvp/me", async (req, res) => {
  if (!requireAuth(req, res)) return;
  const email = req.user.email;
  const row = await dbGet(db, "SELECT pick_json, updated_at FROM mvp_picks WHERE email = ?", [
    email,
  ]);
  const pickRaw = row?.pick_json ?? null;
  const pick =
    pickRaw && typeof pickRaw === "string"
      ? jsonOrNull(pickRaw)
      : pickRaw && typeof pickRaw === "object"
        ? pickRaw
        : null;
  res.json({ email, pick: normalizeMvpPick(pick), updatedAt: row?.updated_at ?? null });
});

app.put("/api/mvp/me", async (req, res) => {
  if (!requireAuth(req, res)) return;
  if (await getPredictionsLocked()) {
    res.status(409).json({ error: "predictions_locked" });
    return;
  }
  const email = req.user.email;
  const pick = normalizeMvpPick(req.body?.pick);
  const updatedAt = new Date().toISOString();
  const pickValue = db?.__dbKind === "pg" ? pick : JSON.stringify(pick);
  await dbRun(
    db,
    "INSERT INTO mvp_picks (email, pick_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET pick_json=excluded.pick_json, updated_at=excluded.updated_at",
    [email, pickValue, updatedAt],
  );
  persistDb(db);
  res.json({ ok: true, updatedAt });
});

app.get("/api/admin/goleadores-result", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const row = await dbGet(db, "SELECT picks_json, updated_at FROM goleadores_result WHERE id = 1", []);
  const picksRaw = row?.picks_json ?? null;
  const picks =
    picksRaw && typeof picksRaw === "string"
      ? jsonOrNull(picksRaw)
      : picksRaw && typeof picksRaw === "object"
        ? picksRaw
        : null;
  res.json({ picks: normalizeGoleadoresPicks(picks), updatedAt: row?.updated_at ?? null });
});

app.put("/api/admin/goleadores-result", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (await getResultsLocked()) {
    res.status(409).json({ error: "results_locked" });
    return;
  }
  const picks = normalizeGoleadoresPicks(req.body?.picks);
  const updatedAt = new Date().toISOString();
  const picksValue = JSON.stringify(picks);
  await dbRun(
    db,
    "INSERT INTO goleadores_result (id, picks_json, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET picks_json=excluded.picks_json, updated_at=excluded.updated_at",
    [picksValue, updatedAt],
  );
  persistDb(db);
  res.json({ ok: true, updatedAt });
});

app.get("/api/admin/zamora-result", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const row = await dbGet(db, "SELECT pick_json, updated_at FROM zamora_result WHERE id = 1", []);
  const pickRaw = row?.pick_json ?? null;
  const pick =
    pickRaw && typeof pickRaw === "string"
      ? jsonOrNull(pickRaw)
      : pickRaw && typeof pickRaw === "object"
        ? pickRaw
        : null;
  res.json({ pick: normalizeZamoraPick(pick), updatedAt: row?.updated_at ?? null });
});

app.put("/api/admin/zamora-result", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (await getResultsLocked()) {
    res.status(409).json({ error: "results_locked" });
    return;
  }
  const pick = normalizeZamoraPick(req.body?.pick);
  const updatedAt = new Date().toISOString();
  const pickValue = db?.__dbKind === "pg" ? pick : JSON.stringify(pick);
  await dbRun(
    db,
    "INSERT INTO zamora_result (id, pick_json, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET pick_json=excluded.pick_json, updated_at=excluded.updated_at",
    [pickValue, updatedAt],
  );
  persistDb(db);
  res.json({ ok: true, updatedAt });
});

app.get("/api/admin/mvp-result", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const row = await dbGet(db, "SELECT pick_json, updated_at FROM mvp_result WHERE id = 1", []);
  const pickRaw = row?.pick_json ?? null;
  const pick =
    pickRaw && typeof pickRaw === "string"
      ? jsonOrNull(pickRaw)
      : pickRaw && typeof pickRaw === "object"
        ? pickRaw
        : null;
  res.json({ pick: normalizeMvpPick(pick), updatedAt: row?.updated_at ?? null });
});

app.put("/api/admin/mvp-result", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (await getResultsLocked()) {
    res.status(409).json({ error: "results_locked" });
    return;
  }
  const pick = normalizeMvpPick(req.body?.pick);
  const updatedAt = new Date().toISOString();
  const pickValue = db?.__dbKind === "pg" ? pick : JSON.stringify(pick);
  await dbRun(
    db,
    "INSERT INTO mvp_result (id, pick_json, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET pick_json=excluded.pick_json, updated_at=excluded.updated_at",
    [pickValue, updatedAt],
  );
  persistDb(db);
  res.json({ ok: true, updatedAt });
});

app.get("/api/admin/users", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = await dbAll(
    db,
    "SELECT email, role, nick, paid, created_at FROM users ORDER BY email ASC",
    [],
  );
  const users = rows.map((r) => ({
    email: r.email,
    role: r.role,
    nick: r.nick ?? null,
    paid: Boolean(r.paid),
    createdAt: r.created_at,
  }));
  res.json({ users });
});

app.put("/api/admin/users/:email/paid", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const email = normalizeEmail(req.params.email);
  if (!email) {
    res.status(400).json({ error: "invalid_email" });
    return;
  }
  const paid = Boolean(req.body?.paid);
  const paidValue = db?.__dbKind === "pg" ? paid : paid ? 1 : 0;
  await dbRun(db, "UPDATE users SET paid = ? WHERE email = ?", [paidValue, email]);
  persistDb(db);
  res.json({ ok: true, email, paid });
});

app.delete("/api/admin/users/:email", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const email = normalizeEmail(req.params.email);
  if (!email || email === ADMIN_EMAIL) {
    res.status(400).json({ error: "invalid_email" });
    return;
  }
  await dbRun(db, "DELETE FROM predictions WHERE email = ?", [email]);
  await dbRun(db, "DELETE FROM users WHERE email = ?", [email]);
  persistDb(db);
  res.json({ ok: true });
});

app.post("/api/admin/users/clear-non-admin", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  await dbRun(db, "DELETE FROM predictions WHERE email <> ?", [ADMIN_EMAIL]);
  await dbRun(db, "DELETE FROM users WHERE email <> ?", [ADMIN_EMAIL]);
  persistDb(db);
  res.json({ ok: true });
});

app.get("/api/admin/predictions", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const email = normalizeEmail(req.query?.email);
  if (!email) {
    res.status(400).json({ error: "invalid_email" });
    return;
  }
  const rows = await dbAll(
    db,
    "SELECT match_id, local, visitante, winner, updated_at FROM predictions WHERE email = ?",
    [email],
  );
  const predictions = {};
  for (const r of rows) {
    predictions[r.match_id] = { local: r.local, visitante: r.visitante, winner: r.winner ?? null };
  }

  const [goleadoresRow, mvpRow, zamoraRow] = await Promise.all([
    dbGet(db, "SELECT picks_json, updated_at FROM goleadores_picks WHERE email = ?", [email]),
    dbGet(db, "SELECT pick_json, updated_at FROM mvp_picks WHERE email = ?", [email]),
    dbGet(db, "SELECT pick_json, updated_at FROM zamora_picks WHERE email = ?", [email]),
  ]);

  const goleadoresRaw = goleadoresRow?.picks_json ?? null;
  const goleadoresParsed =
    goleadoresRaw && typeof goleadoresRaw === "string"
      ? jsonOrNull(goleadoresRaw)
      : goleadoresRaw && typeof goleadoresRaw === "object"
        ? goleadoresRaw
        : null;

  const mvpRaw = mvpRow?.pick_json ?? null;
  const mvpParsed =
    mvpRaw && typeof mvpRaw === "string"
      ? jsonOrNull(mvpRaw)
      : mvpRaw && typeof mvpRaw === "object"
        ? mvpRaw
        : null;

  const zamoraRaw = zamoraRow?.pick_json ?? null;
  const zamoraParsed =
    zamoraRaw && typeof zamoraRaw === "string"
      ? jsonOrNull(zamoraRaw)
      : zamoraRaw && typeof zamoraRaw === "object"
        ? zamoraRaw
        : null;

  res.json({
    email,
    predictions,
    goleadores: {
      picks: normalizeGoleadoresPicks(goleadoresParsed),
      updatedAt: goleadoresRow?.updated_at ?? null,
    },
    mvp: {
      pick: normalizeMvpPick(mvpParsed),
      updatedAt: mvpRow?.updated_at ?? null,
    },
    zamora: {
      pick: normalizeZamoraPick(zamoraParsed),
      updatedAt: zamoraRow?.updated_at ?? null,
    },
    predictionsLocked: await getPredictionsLocked(),
  });
});

app.get("/api/admin/predictions/summary", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const userRows = await dbAll(db, "SELECT email, role FROM users ORDER BY email ASC", []);
  const users = userRows.map((u) => ({ email: u.email, role: u.role }));
  const predRows = await dbAll(
    db,
    "SELECT email, match_id, local, visitante, winner FROM predictions ORDER BY email ASC",
    [],
  );

  const predictionsByUser = {};
  for (const r of predRows) {
    if (!predictionsByUser[r.email]) predictionsByUser[r.email] = {};
    predictionsByUser[r.email][r.match_id] = { local: r.local, visitante: r.visitante, winner: r.winner ?? null };
  }

  res.json({ users, predictionsByUser, predictionsLocked: await getPredictionsLocked() });
});

app.get("/api/admin/predictions/export", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { state } = await getTournamentState();
  const userRows = await dbAll(db, "SELECT email, role, created_at FROM users ORDER BY email ASC", []);
  const users = userRows.map((u) => ({ email: u.email, role: u.role, createdAt: u.created_at }));
  const predRows = await dbAll(
    db,
    "SELECT email, match_id, local, visitante, winner, updated_at FROM predictions ORDER BY email ASC",
    [],
  );
  const predictionsByUser = {};
  for (const r of predRows) {
    if (!predictionsByUser[r.email]) predictionsByUser[r.email] = {};
    predictionsByUser[r.email][r.match_id] = {
      local: r.local,
      visitante: r.visitante,
      winner: r.winner ?? null,
      updatedAt: r.updated_at,
    };
  }

  const payload = {
    type: "mundial2026_predictions_export",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: {
      predictionsLocked: await getPredictionsLocked(),
      resultsLocked: await getResultsLocked(),
    },
    torneo: {
      nombre: state?.torneo?.nombre ?? null,
      fechaInicio: state?.torneo?.fechaInicio ?? null,
    },
    users,
    predictionsByUser,
  };

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=\"pronosticos_${new Date().toISOString().slice(0, 10)}.json\"`,
  );
  res.send(JSON.stringify(payload, null, 2));
});

function clampInt(n) {
  if (n == null) return null;
  const v = Number.parseInt(n, 10);
  return Number.isNaN(v) ? null : v;
}

function outcome(local, visitante) {
  if (local == null || visitante == null) return null;
  if (local === visitante) return "D";
  return local > visitante ? "H" : "A";
}

function extractGroupMatchesWithResults(state, groupId = null) {
  const grupos = state?.grupos ?? {};
  const out = [];
  for (const [gid, g] of Object.entries(grupos)) {
    if (groupId && gid !== groupId) continue;
    for (const p of g?.partidos ?? []) {
      const l = clampInt(p?.resultado?.local);
      const v = clampInt(p?.resultado?.visitante);
      if (l == null || v == null) continue;
      out.push({ id: p.id, local: l, visitante: v, groupId: gid });
    }
  }
  return out;
}

function normalizeKey(s) {
  return String(s ?? "")
    .trim()
    .toLocaleLowerCase("es");
}

async function computeScoreboard(groupId = null) {
  const { state } = await getTournamentState();
  const matches = extractGroupMatchesWithResults(state, groupId);
  const matchIds = new Set(matches.map((m) => m.id));

  const userRows = await dbAll(
    db,
    "SELECT email, role, nick FROM users WHERE role <> 'admin' AND email <> ? ORDER BY email ASC",
    [ADMIN_EMAIL],
  );
  const users = userRows.map((u) => ({ email: u.email, role: u.role, nick: u.nick ?? null }));

  const userEmails = users.map((u) => u.email);
  const userEmailSet = new Set(userEmails);

  const predRows = matchIds.size
    ? await dbAll(
        db,
        `SELECT email, match_id, local, visitante FROM predictions WHERE match_id IN (${[
          ...matchIds,
        ]
          .map(() => "?")
          .join(",")})`,
        [...matchIds],
      )
    : [];

  const predsByUser = new Map();
  for (const r of predRows) {
    const email = r.email;
    if (!predsByUser.has(email)) predsByUser.set(email, new Map());
    predsByUser.get(email).set(r.match_id, { local: r.local, visitante: r.visitante });
  }

  const [goleadoresResultRow, mvpResultRow, zamoraResultRow] = await Promise.all([
    dbGet(db, "SELECT picks_json FROM goleadores_result WHERE id = 1", []),
    dbGet(db, "SELECT pick_json FROM mvp_result WHERE id = 1", []),
    dbGet(db, "SELECT pick_json FROM zamora_result WHERE id = 1", []),
  ]);

  const goleadoresResultRaw = goleadoresResultRow?.picks_json ?? null;
  const goleadoresResultParsed =
    goleadoresResultRaw && typeof goleadoresResultRaw === "string"
      ? jsonOrNull(goleadoresResultRaw)
      : goleadoresResultRaw && typeof goleadoresResultRaw === "object"
        ? goleadoresResultRaw
        : null;
  const goleadoresResult = normalizeGoleadoresPicks(goleadoresResultParsed);

  const mvpResultRaw = mvpResultRow?.pick_json ?? null;
  const mvpResultParsed =
    mvpResultRaw && typeof mvpResultRaw === "string"
      ? jsonOrNull(mvpResultRaw)
      : mvpResultRaw && typeof mvpResultRaw === "object"
        ? mvpResultRaw
        : null;
  const mvpResult = normalizeMvpPick(mvpResultParsed);

  const zamoraResultRaw = zamoraResultRow?.pick_json ?? null;
  const zamoraResultParsed =
    zamoraResultRaw && typeof zamoraResultRaw === "string"
      ? jsonOrNull(zamoraResultRaw)
      : zamoraResultRaw && typeof zamoraResultRaw === "object"
        ? zamoraResultRaw
        : null;
  const zamoraResult = normalizeZamoraPick(zamoraResultParsed);

  const awardQueries = userEmailSet.size
    ? await Promise.all([
        dbAll(
          db,
          `SELECT email, picks_json FROM goleadores_picks WHERE email IN (${userEmails
            .map(() => "?")
            .join(",")})`,
          userEmails,
        ),
        dbAll(
          db,
          `SELECT email, pick_json FROM mvp_picks WHERE email IN (${userEmails.map(() => "?").join(",")})`,
          userEmails,
        ),
        dbAll(
          db,
          `SELECT email, pick_json FROM zamora_picks WHERE email IN (${userEmails
            .map(() => "?")
            .join(",")})`,
          userEmails,
        ),
      ])
    : [[], [], []];

  const [goleadoresPickRows, mvpPickRows, zamoraPickRows] = awardQueries;

  const goleadoresPickByEmail = new Map();
  for (const r of goleadoresPickRows ?? []) {
    const raw = r?.picks_json ?? null;
    const parsed =
      raw && typeof raw === "string" ? jsonOrNull(raw) : raw && typeof raw === "object" ? raw : null;
    goleadoresPickByEmail.set(r.email, normalizeGoleadoresPicks(parsed));
  }

  const mvpPickByEmail = new Map();
  for (const r of mvpPickRows ?? []) {
    const raw = r?.pick_json ?? null;
    const parsed =
      raw && typeof raw === "string" ? jsonOrNull(raw) : raw && typeof raw === "object" ? raw : null;
    mvpPickByEmail.set(r.email, normalizeMvpPick(parsed));
  }

  const zamoraPickByEmail = new Map();
  for (const r of zamoraPickRows ?? []) {
    const raw = r?.pick_json ?? null;
    const parsed =
      raw && typeof raw === "string" ? jsonOrNull(raw) : raw && typeof raw === "object" ? raw : null;
    zamoraPickByEmail.set(r.email, normalizeZamoraPick(parsed));
  }

  const rows = users.map((u) => {
    const userPreds = predsByUser.get(u.email) ?? new Map();
    let exactHits = 0;
    let outcomeHits = 0;
    let points = 0;
    for (const m of matches) {
      const p = userPreds.get(m.id);
      if (!p) continue;
      const pl = clampInt(p.local);
      const pv = clampInt(p.visitante);
      if (pl == null || pv == null) continue;
      if (pl === m.local && pv === m.visitante) {
        exactHits += 1;
        points += 4;
      } else if (outcome(pl, pv) === outcome(m.local, m.visitante)) {
        outcomeHits += 1;
        points += 1;
      }
    }

    let botaDeOroPoints = 0;
    let balonDeOroPoints = 0;
    let guanteDeOroPoints = 0;

    const goleadorWinner = goleadoresResult?.[0] ?? { team: "", player: "" };
    const userGoleadores = goleadoresPickByEmail.get(u.email) ?? [];
    const userGoleador = userGoleadores?.[0] ?? { team: "", player: "" };
    if (
      normalizeKey(goleadorWinner.team) &&
      normalizeKey(goleadorWinner.player) &&
      normalizeKey(userGoleador.team) === normalizeKey(goleadorWinner.team) &&
      normalizeKey(userGoleador.player) === normalizeKey(goleadorWinner.player)
    ) {
      botaDeOroPoints = 10;
      points += 10;
    }

    if (
      normalizeKey(mvpResult.team) &&
      normalizeKey(mvpResult.player) &&
      normalizeKey(mvpPickByEmail.get(u.email)?.team) === normalizeKey(mvpResult.team) &&
      normalizeKey(mvpPickByEmail.get(u.email)?.player) === normalizeKey(mvpResult.player)
    ) {
      balonDeOroPoints = 10;
      points += 10;
    }

    if (
      normalizeKey(zamoraResult.team) &&
      normalizeKey(zamoraResult.goalkeeper) &&
      normalizeKey(zamoraPickByEmail.get(u.email)?.team) === normalizeKey(zamoraResult.team) &&
      normalizeKey(zamoraPickByEmail.get(u.email)?.goalkeeper) ===
        normalizeKey(zamoraResult.goalkeeper)
    ) {
      guanteDeOroPoints = 10;
      points += 10;
    }

    return {
      email: u.email,
      role: u.role,
      nick: u.nick ?? null,
      exactHits,
      outcomeHits,
      botaDeOroPoints,
      balonDeOroPoints,
      guanteDeOroPoints,
      points,
    };
  });

  rows.sort(
    (a, b) => b.points - a.points || b.exactHits - a.exactHits || a.email.localeCompare(b.email),
  );

  return { groupId, playedMatches: matches.length, rows };
}

app.get("/api/scoreboard", async (req, res) => {
  if (!requireAuth(req, res)) return;
  const groupId = String(req.query?.groupId ?? "").trim() || null;
  res.json(await computeScoreboard(groupId));
});

app.get("/api/admin/scoreboard", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const groupId = String(req.query?.groupId ?? "").trim() || null;
  res.json(await computeScoreboard(groupId));
});

app.put("/api/admin/settings", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "predictionsLocked")) {
    await setPredictionsLocked(Boolean(req.body?.predictionsLocked));
  }
  if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "resultsLocked")) {
    await setResultsLocked(Boolean(req.body?.resultsLocked));
  }
  res.json({
    ok: true,
    settings: {
      predictionsLocked: await getPredictionsLocked(),
      resultsLocked: await getResultsLocked(),
    },
  });
});

// Local-only static hosting. On Vercel the frontend is served by the platform.
if (process.env.SERVE_STATIC === "1") {
  const distDir = path.resolve(process.cwd(), "dist");
  app.use(express.static(distDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

export default app;
