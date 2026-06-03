const KEY_PREFIX = "mundial2026_mvp_v1:";

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function keyFor(email) {
  return `${KEY_PREFIX}${String(email ?? "").trim().toLowerCase()}`;
}

function normalizePick(pick) {
  const row = pick && typeof pick === "object" ? pick : {};
  return {
    team: typeof row?.team === "string" ? row.team : "",
    player: typeof row?.player === "string" ? row.player : "",
  };
}

export function loadMvp(email) {
  try {
    const raw = localStorage.getItem(keyFor(email));
    const parsed = raw ? safeParse(raw) : null;
    return { pick: normalizePick(parsed?.pick ?? null) };
  } catch {
    return { pick: normalizePick(null) };
  }
}

export function saveMvp(email, pick) {
  const normalized = normalizePick(pick);

  const payload = {
    version: 1,
    email: String(email ?? "").trim().toLowerCase(),
    updatedAt: new Date().toISOString(),
    pick: normalized,
  };

  localStorage.setItem(keyFor(email), JSON.stringify(payload));
  return payload;
}

