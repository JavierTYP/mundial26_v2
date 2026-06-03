const KEY_PREFIX = "mundial2026_goleadores_v1:";

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

export function loadGoleadores(email) {
  try {
    const raw = localStorage.getItem(keyFor(email));
    const parsed = raw ? safeParse(raw) : null;
    const picks = Array.isArray(parsed?.picks) ? parsed.picks : null;
    return {
      picks: (picks ?? []).slice(0, 3).map((p) => ({
        team: typeof p?.team === "string" ? p.team : "",
        player: typeof p?.player === "string" ? p.player : "",
      })),
    };
  } catch {
    return { picks: [] };
  }
}

export function saveGoleadores(email, picks) {
  const normalized = Array.isArray(picks)
    ? picks.slice(0, 3).map((p) => ({
        team: String(p?.team ?? ""),
        player: String(p?.player ?? ""),
      }))
    : [];

  const payload = {
    version: 1,
    email: String(email ?? "").trim().toLowerCase(),
    updatedAt: new Date().toISOString(),
    picks: normalized,
  };

  localStorage.setItem(keyFor(email), JSON.stringify(payload));
  return payload;
}

