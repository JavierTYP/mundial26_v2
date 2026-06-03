import rankingCsv from "../data/Mundial_2026_Ranking_FIFA.csv?raw";

function normalizeKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function parseRankingCsv(csvText) {
  const map = new Map();
  const lines = String(csvText ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length <= 1) return map;

  for (const line of lines.slice(1)) {
    const parts = line.split(",").map((p) => p.trim());
    if (parts.length < 2) continue;
    const ranking = Number.parseInt(parts[0], 10);
    const name = parts[1];
    if (!Number.isFinite(ranking) || !name) continue;
    map.set(normalizeKey(name), ranking);
  }
  return map;
}

const rankingByNormalizedName = parseRankingCsv(rankingCsv);

export function fifaRankingForTeam(team) {
  if (!team) return null;
  const byName = rankingByNormalizedName.get(normalizeKey(team.nombre));
  if (typeof byName === "number" && Number.isFinite(byName)) return byName;
  const byId = rankingByNormalizedName.get(normalizeKey(team.id));
  if (typeof byId === "number" && Number.isFinite(byId)) return byId;
  return null;
}

export function withFifaRankingsOnGroups(grupos) {
  let changed = false;
  const out = {};
  for (const [gid, grupo] of Object.entries(grupos ?? {})) {
    let equiposChanged = false;
    const equipos = (grupo?.equipos ?? []).map((e) => {
      if (e?.fifaRanking != null) return e;
      const rk = fifaRankingForTeam(e);
      if (rk == null) return e;
      equiposChanged = true;
      return { ...e, fifaRanking: rk };
    });

    if (equiposChanged) {
      changed = true;
      out[gid] = { ...grupo, equipos };
    } else {
      out[gid] = grupo;
    }
  }

  return changed ? out : grupos;
}
