import { useMemo } from "react";
import Card from "./Card.jsx";
import Flag from "./Flag.jsx";

function matchNumber(id) {
  // Use the last numeric suffix so ids like "16-D10" sort by 10 (not 16).
  const m = String(id ?? "").match(/(\d+)(?!.*\d)/);
  return m ? Number.parseInt(m[0], 10) : Number.NaN;
}

function buildTeamIndex(grupos) {
  const out = new Map();
  for (const g of Object.values(grupos ?? {})) {
    for (const e of g?.equipos ?? []) out.set(e.id, e);
  }
  return out;
}

function winnerTeamId(match) {
  if (match?.ganador != null) return match.ganador;
  const l = match?.resultado?.local;
  const v = match?.resultado?.visitante;
  if (l == null || v == null) return null;
  if (match?.local == null || match?.visitante == null) return null;
  if (l > v) return match.local;
  if (v > l) return match.visitante;
  return null;
}

function loserTeamId(match) {
  if (match?.ganador != null) {
    if (match?.local == null || match?.visitante == null) return null;
    if (match.ganador === match.local) return match.visitante;
    if (match.ganador === match.visitante) return match.local;
    return null;
  }
  const l = match?.resultado?.local;
  const v = match?.resultado?.visitante;
  if (l == null || v == null) return null;
  if (match?.local == null || match?.visitante == null) return null;
  if (l > v) return match.visitante;
  if (v > l) return match.local;
  return null;
}

function TeamLine({ team, teamName, score, faded = false }) {
  return (
    <div
      className={`flex h-9 items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 text-xs ${
        faded ? "text-slate-500" : "text-slate-100"
      }`}
      title={teamName}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {team ? (
          <Flag
            team={team}
            className="h-4 w-5 shrink-0 rounded-[2px] object-cover ring-1 ring-white/10"
          />
        ) : null}
        <div className="min-w-0 flex-1 truncate font-semibold">{teamName}</div>
      </div>
      <div className="w-6 text-right font-black text-slate-200">
        {score == null ? " " : score}
      </div>
    </div>
  );
}

function MatchCard({ title, match, teamIndex, fallbackLabel = null, showMatchId = true }) {
  const localTeam = match?.local ? teamIndex.get(match.local) : null;
  const awayTeam = match?.visitante ? teamIndex.get(match.visitante) : null;
  const localName = localTeam?.nombre ?? (match?.local ? String(match.local) : fallbackLabel ?? "—");
  const awayName =
    awayTeam?.nombre ?? (match?.visitante ? String(match.visitante) : fallbackLabel ?? "—");
  const lScore = match?.resultado?.local ?? null;
  const vScore = match?.resultado?.visitante ?? null;
  const hasTeams = Boolean(match?.local) || Boolean(match?.visitante);

  return (
    <div className="h-[92px] space-y-2">
      {title ? (
        <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">{title}</div>
      ) : null}
      {showMatchId && match?.id ? (
        <div className="-mt-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
          {match.id}
        </div>
      ) : null}
      <div className="space-y-1">
        <TeamLine team={localTeam} teamName={localName} score={lScore} faded={!hasTeams} />
        <TeamLine team={awayTeam} teamName={awayName} score={vScore} faded={!hasTeams} />
      </div>
    </div>
  );
}

function matchById(list, id) {
  return (list ?? []).find((m) => m.id === id) ?? null;
}

function sortByNumericId(a, b) {
  return matchNumber(a?.id) - matchNumber(b?.id);
}

export default function KnockoutBracket({
  torneo,
  title = "Eliminatorias",
  description = "Se rellena automaticamente a medida que se introducen resultados.",
}) {
  // Layout tuned to keep rounds vertically aligned by making each match card a fixed height
  // and spacing columns based on a shared "slot" size.
  const MATCH_H = 92; // px (must match MatchCard height)
  const GAP_16 = 24; // px gap between 16avos matches
  const SLOT_16 = MATCH_H + GAP_16; // px vertical distance between match tops in 16avos

  const teamIndex = useMemo(() => buildTeamIndex(torneo?.grupos), [torneo?.grupos]);

  const dieciseisavos = useMemo(
    () => [...(torneo?.dieciseisavos ?? [])].sort(sortByNumericId),
    [torneo?.dieciseisavos],
  );
  const octavos = useMemo(
    () => [...(torneo?.octavos ?? [])].sort(sortByNumericId),
    [torneo?.octavos],
  );
  const cuartos = useMemo(
    () => [...(torneo?.cuartos ?? [])].sort(sortByNumericId),
    [torneo?.cuartos],
  );
  const semifinales = useMemo(
    () => [...(torneo?.semifinales ?? [])].sort(sortByNumericId),
    [torneo?.semifinales],
  );

  const finalMatch = torneo?.final ?? null;
  const semi1 = semifinales.find((m) => matchNumber(m.id) === 1) ?? null;
  const semi2 = semifinales.find((m) => matchNumber(m.id) === 2) ?? null;

  const thirdPlace = useMemo(() => {
    if (torneo?.thirdPlace) return torneo.thirdPlace;
    const local = loserTeamId(semi1);
    const visitante = loserTeamId(semi2);
    return {
      id: "3P-31",
      local,
      visitante,
      resultado: { local: null, visitante: null },
    };
  }, [semi1, semi2, torneo?.thirdPlace]);

  const col16Left = dieciseisavos.filter((m) => matchNumber(m.id) >= 1 && matchNumber(m.id) <= 8);
  const col16Right = dieciseisavos.filter(
    (m) => matchNumber(m.id) >= 9 && matchNumber(m.id) <= 16,
  );

  const col8Left = octavos.filter((m) => matchNumber(m.id) >= 1 && matchNumber(m.id) <= 4);
  const col8Right = octavos.filter((m) => matchNumber(m.id) >= 5 && matchNumber(m.id) <= 8);

  const col4Left = cuartos.filter((m) => matchNumber(m.id) >= 1 && matchNumber(m.id) <= 2);
  const col4Right = cuartos.filter((m) => matchNumber(m.id) >= 3 && matchNumber(m.id) <= 4);

  const colSemiLeft = semifinales.filter((m) => matchNumber(m.id) === 1);
  const colSemiRight = semifinales.filter((m) => matchNumber(m.id) === 2);

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-black tracking-tight">{title}</h3>
        {description ? <p className="text-sm text-slate-300">{description}</p> : null}
      </div>

      <div className="mt-4 overflow-x-auto bracket-scroll">
        <div className="min-w-[1320px]">
          <div className="grid grid-cols-[repeat(9,minmax(128px,1fr))] gap-5 text-center text-[11px] font-black uppercase tracking-wide text-slate-400">
            <div>16avos</div>
            <div>8avos</div>
            <div>4tos</div>
            <div>Semis</div>
            <div>Final</div>
            <div>Semis</div>
            <div>4tos</div>
            <div>8avos</div>
            <div>16avos</div>
          </div>

          <div className="mt-4 grid grid-cols-[repeat(9,minmax(128px,1fr))] gap-5">
            <div className="flex flex-col" style={{ gap: `${GAP_16}px` }}>
              {col16Left.map((m) => (
                <MatchCard key={m.id} match={m} teamIndex={teamIndex} />
              ))}
            </div>

            <div
              className="flex flex-col"
              style={{ gap: `${SLOT_16 * 2 - MATCH_H}px`, paddingTop: `${SLOT_16 / 2}px` }}
            >
              {col8Left.map((m) => (
                <MatchCard key={m.id} match={m} teamIndex={teamIndex} />
              ))}
            </div>

            <div
              className="flex flex-col"
              style={{ gap: `${SLOT_16 * 4 - MATCH_H}px`, paddingTop: `${SLOT_16 * 1.5}px` }}
            >
              {col4Left.map((m) => (
                <MatchCard key={m.id} match={m} teamIndex={teamIndex} />
              ))}
            </div>

            <div
              className="flex flex-col"
              style={{ gap: `${SLOT_16 * 8 - MATCH_H}px`, paddingTop: `${SLOT_16 * 3.5}px` }}
            >
              {colSemiLeft.map((m) => (
                <MatchCard key={m.id} match={m} teamIndex={teamIndex} />
              ))}
            </div>

            <div
              className="flex flex-col items-center gap-6"
              style={{ paddingTop: `${SLOT_16 * 3}px` }}
            >
              <div className="w-full max-w-[240px] rounded-2xl border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-center text-xs font-black uppercase tracking-wide text-slate-300">
                  Final
                </div>
                <div className="mt-3">
                  <MatchCard match={finalMatch} teamIndex={teamIndex} />
                </div>
              </div>

              <div className="w-full max-w-[240px] rounded-2xl border border-slate-800 bg-slate-950/30 p-3">
                <div className="text-center text-xs font-black uppercase tracking-wide text-slate-300">
                  3er puesto
                </div>
                <div className="mt-3">
                  <MatchCard match={thirdPlace} teamIndex={teamIndex} />
                </div>
              </div>
            </div>

            <div
              className="flex flex-col"
              style={{ gap: `${SLOT_16 * 8 - MATCH_H}px`, paddingTop: `${SLOT_16 * 3.5}px` }}
            >
              {colSemiRight.map((m) => (
                <MatchCard key={m.id} match={m} teamIndex={teamIndex} />
              ))}
            </div>

            <div
              className="flex flex-col"
              style={{ gap: `${SLOT_16 * 4 - MATCH_H}px`, paddingTop: `${SLOT_16 * 1.5}px` }}
            >
              {col4Right.map((m) => (
                <MatchCard key={m.id} match={m} teamIndex={teamIndex} />
              ))}
            </div>

            <div
              className="flex flex-col"
              style={{ gap: `${SLOT_16 * 2 - MATCH_H}px`, paddingTop: `${SLOT_16 / 2}px` }}
            >
              {col8Right.map((m) => (
                <MatchCard key={m.id} match={m} teamIndex={teamIndex} />
              ))}
            </div>

            <div className="flex flex-col" style={{ gap: `${GAP_16}px` }}>
              {col16Right.map((m) => (
                <MatchCard key={m.id} match={m} teamIndex={teamIndex} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
