import { groupIsComplete, calculateStandings } from "./standings.js";
import annexCThirdsMapping from "../data/annexC_2026_thirds_mapping.json" assert { type: "json" };

export function getClassifiedByGroup(grupos, resultsByMatchId = null) {
  const standingsOpts = resultsByMatchId
    ? { fallbackToPartidoResultado: false }
    : { fallbackToPartidoResultado: true };
  const out = {};
  for (const [gid, grupo] of Object.entries(grupos)) {
    // IMPORTANT:
    // For predictions mode we only classify a group once ALL its matches have predicted scores.
    // Otherwise we may prematurely (and incorrectly) determine the 8 best third-placed teams,
    // which then drives the Annex C assignment for Round of 32 pairings.
    if (resultsByMatchId) {
      if (!groupIsComplete(grupo, resultsByMatchId, { fallbackToPartidoResultado: false })) continue;
    } else if (!groupIsComplete(grupo, resultsByMatchId, standingsOpts)) continue;

    const standings = calculateStandings(grupo, resultsByMatchId, standingsOpts);
    out[gid] = { first: standings[0], second: standings[1], third: standings[2] };
  }
  return out;
}

function compareTeamsForRanking(a, b) {
  // Higher is better for: pts, dg, gf, fairPlay (when stored as FIFA-style negatives, -1 > -3).
  if (b.pts !== a.pts) return b.pts - a.pts;
  if (b.dg !== a.dg) return b.dg - a.dg;
  if (b.gf !== a.gf) return b.gf - a.gf;
  const fp = fairPlayScore(b) - fairPlayScore(a);
  if (fp !== 0) return fp;
  // Lower FIFA ranking number is better.
  const rk = fifaRanking(a) - fifaRanking(b);
  if (rk !== 0) return rk;
  return String(a.nombre ?? "").localeCompare(String(b.nombre ?? ""));
}

function fairPlayScore(team) {
  // Higher is better. If you store "fairPlay" as negative points (FIFA style),
  // this still works because -1 > -3.
  const v = team?.fairPlay;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function fifaRanking(team) {
  // Lower is better. Missing ranking is treated as very low priority.
  const v = team?.fifaRanking;
  return typeof v === "number" && Number.isFinite(v) ? v : Number.POSITIVE_INFINITY;
}

export function getBestThirds(grupos, limit = 8, resultsByMatchId = null) {
  const classified = getClassifiedByGroup(grupos, resultsByMatchId);
  const thirds = Object.entries(classified)
    .map(([gid, g]) => ({ gid, team: g.third }))
    .filter((x) => x.team);

  thirds.sort((a, b) => compareTeamsForRanking(a.team, b.team));

  return thirds.slice(0, limit);
}

function resolveToken(token, classified) {
  // token examples: "1A", "2B"
  const pos = token[0];
  const gid = token.slice(1);
  const g = classified[gid];
  if (!g) return null;
  if (pos === "1") return g.first;
  if (pos === "2") return g.second;
  if (pos === "3") return g.third;
  return null;
}

function rankGroupFinishers(grupos, position, resultsByMatchId = null) {
  // position: "first" | "second" | "third"
  const classified = getClassifiedByGroup(grupos, resultsByMatchId);
  const list = Object.entries(classified)
    .map(([gid, g]) => ({ gid, team: g[position] }))
    .filter((x) => x.team);
  list.sort((a, b) => compareTeamsForRanking(a.team, b.team));
  return list;
}

export function buildDieciseisavos(dieciseisavosTemplate, grupos, resultsByMatchId = null) {
  const classified = getClassifiedByGroup(grupos, resultsByMatchId);

  const bestThirds = getBestThirds(grupos, 8, resultsByMatchId);
  const qualifiedThirdGroups = [...new Set(bestThirds.map((x) => x.gid))].sort();
  const combinationKey = qualifiedThirdGroups.join("");
  // Only resolve Annex C assignment once we have 8 qualifying third-placed groups.
  const allGroupsComplete = Object.keys(classified).length === 12;
  const assignment = (allGroupsComplete && qualifiedThirdGroups.length === 8) ? annexCThirdsMapping?.[combinationKey] ?? null : null;

  const thirdsByGroup = {};
  for (const { gid, team } of bestThirds) {
    if (team?.id) thirdsByGroup[gid] = team;
  }

  const resolveThirdForWinner = (winnerGroupId) => {
    if (!assignment) return null;
    const colIndexByWinner = { A: 0, B: 1, D: 2, E: 3, G: 4, I: 5, K: 6, L: 7 };
    const idx = colIndexByWinner[winnerGroupId];
    if (idx == null) return null;
    const thirdGroupId = assignment[idx];
    return thirdsByGroup[thirdGroupId] ?? null;
  };

  const resolveR32Token = (token) => {
    const t = String(token ?? "").trim();
    if (!t) return null;
    if (/^[12][A-L]$/.test(t)) return resolveToken(t, classified);
    // "3ABCDF" etc. The actual group is determined by Annex C and depends on the winner group on the other side.
    if (/^3[A-L]{2,}$/.test(t)) return { __thirdPlaceholder: true, options: t.slice(1) };
    return null;
  };

  return dieciseisavosTemplate.map((m) => {
    const [aRaw, bRaw] = String(m.emparejamiento).split("vs").map((s) => s.trim());
    const a = resolveR32Token(aRaw);
    const b = resolveR32Token(bRaw);

    let localTeam = a?.__thirdPlaceholder ? null : a;
    let awayTeam = b?.__thirdPlaceholder ? null : b;

    if (a?.__thirdPlaceholder && /^[1][A-L]$/.test(bRaw)) {
      const winnerGroupId = bRaw.slice(1);
      localTeam = resolveThirdForWinner(winnerGroupId);
    } else if (b?.__thirdPlaceholder && /^[1][A-L]$/.test(aRaw)) {
      const winnerGroupId = aRaw.slice(1);
      awayTeam = resolveThirdForWinner(winnerGroupId);
    }

    return {
      ...m,
      local: localTeam?.id ?? null,
      visitante: awayTeam?.id ?? null,
    };
  });
}

export function buildOctavos(octavosTemplate, grupos) {
  const classified = getClassifiedByGroup(grupos);
  return octavosTemplate.map((m) => {
    const [a, b] = String(m.emparejamiento).split("vs").map((s) => s.trim());
    const localTeam = resolveToken(a, classified);
    const awayTeam = resolveToken(b, classified);
    return {
      ...m,
      local: localTeam?.id ?? null,
      visitante: awayTeam?.id ?? null,
    };
  });
}

export function winnerId(match) {
  if (
    match?.resultado?.local == null ||
    match?.resultado?.visitante == null ||
    match.local == null ||
    match.visitante == null
  )
    return null;
  if (match.resultado.local > match.resultado.visitante) return match.local;
  if (match.resultado.local < match.resultado.visitante) return match.visitante;
  const picked = match?.ganador ?? null;
  if (picked === match.local || picked === match.visitante) return picked;
  return null;
}

export function advanceRound(nextTemplate, previousMatches, pairingKey) {
  // pairingKey is like "08-O1 vs 08-O2"
  const map = new Map(previousMatches.map((m) => [m.id, winnerId(m)]));
  return nextTemplate.map((m) => {
    const [a, b] = String(m.emparejamiento).split("vs").map((s) => s.trim());
    if (!a || !b) return m;
    const local = map.get(a) ?? null;
    const visitante = map.get(b) ?? null;
    return { ...m, local, visitante };
  });
}
