import { useMemo } from "react";
import Card from "../components/Card.jsx";
import { buildPredictedKnockoutTournament } from "../utils/predictedKnockout.js";

function matchNumber(id) {
  const m = String(id ?? "").match(/(\d+)(?!.*\d)/);
  return m ? Number.parseInt(m[0], 10) : Number.NaN;
}

function buildTeamsIndex(grupos) {
  const map = new Map();
  for (const g of Object.values(grupos ?? {})) {
    const equipos = Array.isArray(g?.equipos)
      ? g.equipos
      : g?.equipos && typeof g.equipos === "object"
        ? Object.values(g.equipos)
        : [];
    for (const e of equipos) {
      if (!e?.id) continue;
      map.set(e.id, e);
    }
  }
  return map;
}

function buildMatchesIndex(torneo) {
  const map = new Map();

  for (const g of Object.values(torneo?.grupos ?? {})) {
    const matches = Array.isArray(g?.partidos) ? g.partidos : [];
    for (const m of matches) {
      if (m?.id) map.set(m.id, m);
    }
  }

  const addList = (list) => {
    const matches = Array.isArray(list) ? list : [];
    for (const m of matches) {
      if (m?.id) map.set(m.id, m);
    }
  };

  addList(torneo?.dieciseisavos);
  addList(torneo?.octavos);
  addList(torneo?.cuartos);
  addList(torneo?.semifinales);
  if (torneo?.final?.id) map.set(torneo.final.id, torneo.final);
  if (torneo?.thirdPlace?.id) map.set(torneo.thirdPlace.id, torneo.thirdPlace);

  return map;
}

function loserTeamId(match) {
  if (!match) return null;
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

function formatPrediction(prediction) {
  if (!prediction) return "Pendiente";
  const l = prediction?.local;
  const v = prediction?.visitante;
  if (l == null || v == null) return "Pendiente";
  return `${l} - ${v}`;
}

function formatRealResult(match) {
  const l = match?.resultado?.local;
  const v = match?.resultado?.visitante;
  if (l == null || v == null) return "Pendiente";
  return `${l} - ${v}`;
}

function realWinnerId(match) {
  const l = match?.resultado?.local;
  const v = match?.resultado?.visitante;
  if (l == null || v == null) return null;
  const localId = matchLocalId(match);
  const awayId = matchAwayId(match);
  if (!localId || !awayId) return null;
  if (l > v) return localId;
  if (v > l) return awayId;
  return "tie";
}

function tieWinnerFromPrediction(prediction, match) {
  const l = prediction?.local ?? null;
  const v = prediction?.visitante ?? null;
  if (l == null || v == null) return null;
  if (l !== v) return null;
  const picked = prediction?.winner ?? null;
  if (!picked) return null;
  const localId = matchLocalId(match);
  const awayId = matchAwayId(match);
  if (!localId || !awayId) return null;
  if (picked === localId) return localId;
  if (picked === awayId) return awayId;
  return null;
}

function rowKey(row) {
  return `${row.phase}:${row.match?.id ?? row.id}`;
}

function matchLocalId(match) {
  return match?.local ?? match?.idLocal ?? null;
}

function matchAwayId(match) {
  return match?.visitante ?? match?.idVisitante ?? null;
}

export default function ResumenView({ torneo, predictionsByMatchId }) {
  const teamsById = useMemo(() => buildTeamsIndex(torneo?.grupos), [torneo?.grupos]);
  const realMatchesById = useMemo(() => buildMatchesIndex(torneo), [torneo]);

  const { predictedTorneo, buildError } = useMemo(() => {
    try {
      return { predictedTorneo: buildPredictedKnockoutTournament(torneo, predictionsByMatchId), buildError: null };
    } catch (e) {
      return { predictedTorneo: torneo, buildError: e instanceof Error ? e : new Error("Resumen_failed") };
    }
  }, [predictionsByMatchId, torneo]);

  const rows = useMemo(() => {
    try {
      const out = [];

      const groupOrder = "ABCDEFGHIJKL".split("");
      for (const gid of groupOrder) {
        const group = torneo?.grupos?.[gid] ?? null;
        const matches = Array.isArray(group?.partidos) ? [...group.partidos] : [];
        matches.sort((a, b) => matchNumber(a?.id) - matchNumber(b?.id));
        for (const match of matches) {
          out.push({ phase: `Grupo ${gid}`, match });
        }
      }

      const ko = predictedTorneo ?? torneo;
      const addKo = (phase, list) => {
        out.push({ type: "separator", id: `sep:${phase}` });
        const matches = Array.isArray(list) ? [...list] : [];
        matches.sort((a, b) => matchNumber(a?.id) - matchNumber(b?.id));
        for (const match of matches) out.push({ phase, match });
      };

      addKo("16avos", ko?.dieciseisavos);
      addKo("8avos", ko?.octavos);
      addKo("4tos", ko?.cuartos);
      addKo("Semis", ko?.semifinales);

      const semifinales = Array.isArray(ko?.semifinales) ? [...ko.semifinales] : [];
      semifinales.sort((a, b) => matchNumber(a?.id) - matchNumber(b?.id));
      const semi1 = semifinales.find((m) => matchNumber(m?.id) === 1) ?? null;
      const semi2 = semifinales.find((m) => matchNumber(m?.id) === 2) ?? null;
      out.push({ type: "separator", id: "sep:final" });
      out.push({
        phase: "3er puesto",
        match: {
          id: "3P-31",
          local: loserTeamId(semi1),
          visitante: loserTeamId(semi2),
        },
      });

      if (ko?.final) out.push({ phase: "Final", match: ko.final });

      return out;
    } catch {
      return [];
    }
  }, [predictedTorneo, torneo]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight">Resumen</h2>
        <p className="text-sm text-slate-300">
          Tabla completa de partidos, ordenada por fase, con tus pronósticos.
        </p>
      </div>

      {buildError ? (
        <Card className="p-4">
          <div className="text-sm text-slate-300">
            Error al generar el resumen:{" "}
            <span className="font-mono text-xs text-slate-200">{buildError.message}</span>
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-[880px] w-full border-collapse text-sm">
            <thead className="bg-slate-950/60">
              <tr className="text-left text-xs font-black uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Fase</th>
                <th className="px-4 py-3">Partido</th>
                <th className="px-4 py-3">Local</th>
                <th className="px-4 py-3">Visitante</th>
                <th className="px-4 py-3">Resultado real</th>
                <th className="px-4 py-3">Pronóstico</th>
                <th className="px-4 py-3">Ganador (empate)</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-300" colSpan={7}>
                    No hay partidos para mostrar todavÃ­a.
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => {
                if (row?.type === "separator") {
                  return (
                    <tr key={row.id} className="border-t border-slate-800">
                      <td colSpan={7} className="h-4 bg-slate-950/30" />
                    </tr>
                  );
                }

                const match = row.match ?? null;
                const realMatch = match?.id ? realMatchesById.get(match.id) ?? null : null;
                const localId = matchLocalId(match);
                const awayId = matchAwayId(match);
                const localTeam = localId ? teamsById.get(localId) : null;
                const awayTeam = awayId ? teamsById.get(awayId) : null;
                const prediction = predictionsByMatchId?.[match?.id] ?? null;
                const realWinner = realWinnerId(realMatch);
                const winnerTeam =
                  realWinner && realWinner !== "tie" ? teamsById.get(realWinner) : null;
                const showTieWinner = !String(row.phase ?? "").toLowerCase().startsWith("grupo");
                const tieWinner = showTieWinner ? tieWinnerFromPrediction(prediction, match) : null;
                const tieWinnerTeam = tieWinner ? teamsById.get(tieWinner) : null;

                return (
                  <tr key={rowKey(row)} className="border-t border-slate-800">
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-200">
                      {row.phase}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-300">
                      {match?.id ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-100">
                      {localTeam?.nombre ?? (localId ? String(localId) : "Por definir")}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-100">
                      {awayTeam?.nombre ?? (awayId ? String(awayId) : "Por definir")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-black text-slate-100">
                      {formatRealResult(realMatch)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-black text-slate-100">
                      {formatPrediction(prediction)}
                    </td>
                    <td className="px-4 py-3 text-slate-200">
                      {showTieWinner ? tieWinnerTeam?.nombre ?? (tieWinner ? String(tieWinner) : "-") : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
