import fs from "node:fs";
import path from "node:path";
import { createDb, dbGet, dbRun, persistDbNow } from "./db.js";
import { ADMIN_EMAIL } from "../src/utils/authStorage.js";

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function allGroupMatchIds(state) {
  const ids = [];
  for (const g of Object.values(state?.grupos ?? {})) {
    for (const p of g?.partidos ?? []) ids.push(p.id);
  }
  return ids;
}

const sampleUsers = [
  "mgarcia@typsa.es",
  "lrodriguez@typsa.es",
  "aperez@typsa.es",
].map(normalizeEmail);

const initialState = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "src", "data", "mundial2026.json"), "utf8"),
);

const { db, dbPath } = await createDb();

// Ensure admin user exists
if (!(await dbGet(db, "SELECT email FROM users WHERE email = ?", [ADMIN_EMAIL]))) {
  await dbRun(db, "INSERT INTO users (email, role, created_at) VALUES (?, ?, ?)", [
    ADMIN_EMAIL,
    "admin",
    new Date().toISOString(),
  ]);
}

for (const email of sampleUsers) {
  if (!(await dbGet(db, "SELECT email FROM users WHERE email = ?", [email]))) {
    await dbRun(db, "INSERT INTO users (email, role, created_at) VALUES (?, ?, ?)", [
      email,
      "user",
      new Date().toISOString(),
    ]);
  }
}

const matchIds = allGroupMatchIds(initialState);
const now = new Date().toISOString();
for (const email of sampleUsers) {
  for (const matchId of matchIds) {
    const local = randInt(0, 4);
    const visitante = randInt(0, 4);
    await dbRun(
      db,
      "INSERT INTO predictions (email, match_id, local, visitante, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(email, match_id) DO UPDATE SET local=excluded.local, visitante=excluded.visitante, updated_at=excluded.updated_at",
      [email, matchId, local, visitante, now],
    );
  }
}

persistDbNow(db);
// eslint-disable-next-line no-console
console.log(
  `Seeded ${sampleUsers.length} users and random group-stage predictions in ${dbPath}`,
);
