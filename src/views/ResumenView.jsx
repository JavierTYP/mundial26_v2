import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import Flag from "../components/Flag.jsx";
import {
  apiGetMyGoleadores,
  apiGetMyMvp,
  apiGetMyZamora,
} from "../utils/api.js";
import { normalizeKnockoutPicks } from "./EliminatoriasView.jsx";

const KNOCKOUT_ROUNDS = [
  { key: "16avos", label: "16avos" },
  { key: "8avos", label: "8avos" },
  { key: "4tos", label: "4tos" },
  { key: "semis", label: "Semis" },
  { key: "final", label: "Final" },
  { key: "campeon", label: "Campeón" },
];

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

function formatPrediction(prediction) {
  if (!prediction) return "Pendiente";
  const l = prediction?.local;
  const v = prediction?.visitante;
  if (l == null || v == null) return "Pendiente";
  return `${l} - ${v}`;
}

function formatResult(result) {
  const l = result?.local;
  const v = result?.visitante;
  if (l == null || v == null) return "-";
  return `${l} - ${v}`;
}

function formatTeamName(teamsById, teamId) {
  const id = String(teamId ?? "").trim();
  if (!id) return "Pendiente";
  return teamsById.get(id)?.nombre ?? id;
}

function TeamName({ team, fallback = "Pendiente", className = "" }) {
  const name = team?.nombre ?? fallback;
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      {team ? <Flag team={team} className="h-4 w-4 shrink-0" /> : null}
      <span className="min-w-0 truncate">{name}</span>
    </span>
  );
}

function formatAwardPick(pick, field) {
  const player = String(pick?.[field] ?? "").trim();
  const team = String(pick?.team ?? "").trim();
  if (!player && !team) return "Pendiente";
  if (!team) return player || "Pendiente";
  if (!player) return team;
  return `${player} (${team})`;
}

export default function ResumenView({
  torneo,
  predictionsByMatchId,
  knockoutPicks,
  userEmail,
  isAdmin = false,
}) {
  const teamsById = useMemo(() => buildTeamsIndex(torneo?.grupos), [torneo?.grupos]);
  const normalizedKnockoutPicks = useMemo(
    () => normalizeKnockoutPicks(knockoutPicks),
    [knockoutPicks],
  );
  const [awards, setAwards] = useState({ goleadores: [], mvp: null, zamora: null });

  useEffect(() => {
    let cancelled = false;
    if (!userEmail) {
      setAwards({ goleadores: [], mvp: null, zamora: null });
      return () => {
        cancelled = true;
      };
    }

    void Promise.all([apiGetMyGoleadores(), apiGetMyMvp(), apiGetMyZamora()])
      .then(([goleadores, mvp, zamora]) => {
        if (cancelled) return;
        setAwards({
          goleadores: Array.isArray(goleadores?.picks) ? goleadores.picks : [],
          mvp: mvp?.pick ?? null,
          zamora: zamora?.pick ?? null,
        });
      })
      .catch(() => {
        if (!cancelled) setAwards({ goleadores: [], mvp: null, zamora: null });
      });

    return () => {
      cancelled = true;
    };
  }, [userEmail]);

  const groupRows = useMemo(() => {
    const out = [];
    const groupOrder = Object.keys(torneo?.grupos ?? {}).sort((a, b) => a.localeCompare(b, "es"));
    for (const gid of groupOrder) {
      const group = torneo?.grupos?.[gid] ?? null;
      const matches = Array.isArray(group?.partidos) ? [...group.partidos] : [];
      matches.sort((a, b) => matchNumber(a?.id) - matchNumber(b?.id));
      for (const match of matches) {
        const localId = match?.local ?? match?.idLocal ?? null;
        const awayId = match?.visitante ?? match?.idVisitante ?? null;
        out.push({
          phase: `Grupo ${gid}`,
          id: match?.id ?? "",
          localId,
          awayId,
          local: formatTeamName(teamsById, localId),
          visitante: formatTeamName(teamsById, awayId),
          prediction: isAdmin
            ? formatResult(match?.resultado)
            : formatPrediction(predictionsByMatchId?.[match?.id]),
          result: formatResult(match?.resultado),
        });
      }
    }
    return out;
  }, [isAdmin, predictionsByMatchId, teamsById, torneo?.grupos]);

  const awardRows = useMemo(() => {
    const goleador = Array.isArray(awards.goleadores) ? awards.goleadores[0] : null;
    return [
      { label: "Balón de oro", value: formatAwardPick(awards.mvp, "player"), team: awards.mvp?.team },
      { label: "Bota de oro", value: formatAwardPick(goleador, "player"), team: goleador?.team },
      { label: "Guante de oro", value: formatAwardPick(awards.zamora, "goalkeeper"), team: awards.zamora?.team },
    ];
  }, [awards]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight">Resumen</h2>
        <p className="text-sm text-slate-300">
          Tus pronósticos de grupos, selecciones de eliminatorias y premios individuales.
        </p>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-800 bg-slate-950/60 px-4 py-3">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-200">
            Fase de grupos
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full border-collapse text-sm">
            <thead className="bg-slate-950/60">
              <tr className="text-left text-xs font-black uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Fase</th>
                <th className="px-4 py-3">Partido</th>
                <th className="px-4 py-3">Local</th>
                <th className="px-4 py-3">Visitante</th>
                <th className="px-4 py-3">Pronóstico</th>
                <th className="px-4 py-3">RESULTADOS</th>
              </tr>
            </thead>
            <tbody>
              {groupRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-300" colSpan={6}>
                    No hay pronósticos de grupos para mostrar todavía.
                  </td>
                </tr>
              ) : null}
              {groupRows.map((row) => (
                <tr key={`${row.phase}:${row.id}`} className="border-t border-slate-800">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-200">
                    {row.phase}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-300">
                    {row.id || "-"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-100">
                    <TeamName team={teamsById.get(row.localId)} fallback={row.local} />
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-100">
                    <TeamName team={teamsById.get(row.awayId)} fallback={row.visitante} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-black text-slate-100">
                    {row.prediction}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-black text-slate-100">
                    {row.result}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-800 bg-slate-950/60 px-4 py-3">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-200">
            Eliminatorias
          </h3>
        </div>
        <div className="divide-y divide-slate-800">
          {KNOCKOUT_ROUNDS.map((round) => {
            const teams = normalizedKnockoutPicks[round.key] ?? [];
            return (
              <div key={round.key} className="grid gap-2 px-4 py-4 md:grid-cols-[120px_1fr]">
                <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                  {round.label}
                </div>
                <div className="flex flex-wrap gap-2">
                  {teams.length ? (
                    teams.map((teamId) => {
                      const team = teamsById.get(teamId);
                      return (
                        <span
                          key={teamId}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-bold text-slate-100 ring-1 ring-slate-700/70"
                        >
                          {team ? <Flag team={team} className="h-4 w-4 shrink-0" /> : null}
                          <span>{formatTeamName(teamsById, teamId)}</span>
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-sm text-slate-500">Pendiente</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-800 bg-slate-950/60 px-4 py-3">
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-200">
            Premios individuales
          </h3>
        </div>
        <div className="divide-y divide-slate-800">
          {awardRows.map((row) => (
            <div key={row.label} className="grid gap-1 px-4 py-4 md:grid-cols-[160px_1fr]">
              <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                {row.label}
              </div>
              <div className="inline-flex min-w-0 items-center gap-2 font-semibold text-slate-100">
                {row.team ? <Flag name={row.team} className="h-4 w-4 shrink-0" /> : null}
                <span className="min-w-0 truncate">{row.value}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}
