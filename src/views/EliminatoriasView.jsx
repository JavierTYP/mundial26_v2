import { useMemo } from "react";

import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import Flag from "../components/Flag.jsx";
import { calculateStandings } from "../utils/standings.js";

export const ADVANCEMENT_ROUNDS = [
  { key: "16avos", label: "16AVOS", limit: 32, previousKey: null },
  { key: "8avos", label: "8AVOS", limit: 16, previousKey: "16avos" },
  { key: "4tos", label: "4TOS", limit: 8, previousKey: "8avos" },
  { key: "semis", label: "SEMIS", limit: 4, previousKey: "4tos" },
  { key: "final", label: "FINAL", limit: 2, previousKey: "semis" },
  { key: "campeon", label: "CAMPEON", limit: 1, previousKey: "final" },
];

export function createEmptyKnockoutPicks() {
  return Object.fromEntries(ADVANCEMENT_ROUNDS.map((round) => [round.key, []]));
}

export function normalizeKnockoutPicks(picks) {
  const row = picks && typeof picks === "object" ? picks : {};
  const normalized = {};

  for (const round of ADVANCEMENT_ROUNDS) {
    const allowedPrevious = round.previousKey ? new Set(normalized[round.previousKey] ?? []) : null;
    const seen = new Set();
    const values = Array.isArray(row?.[round.key]) ? row[round.key] : [];

    normalized[round.key] = values
      .map((teamId) => String(teamId ?? "").trim())
      .filter((teamId) => {
        if (!teamId) return false;
        if (seen.has(teamId)) return false;
        if (allowedPrevious && !allowedPrevious.has(teamId)) return false;
        seen.add(teamId);
        return true;
      })
      .slice(0, round.limit);
  }

  return normalized;
}

export function toggleKnockoutPick(picks, roundKey, teamId, selected) {
  const normalized = normalizeKnockoutPicks(picks);
  const roundIndex = ADVANCEMENT_ROUNDS.findIndex((round) => round.key === roundKey);
  if (roundIndex < 0) return normalized;

  if (selected) {
    const round = ADVANCEMENT_ROUNDS[roundIndex];
    const current = normalized[round.key] ?? [];
    if (current.includes(teamId) || current.length >= round.limit) return normalized;
    if (round.previousKey && !normalized[round.previousKey]?.includes(teamId)) return normalized;
    return normalizeKnockoutPicks({
      ...normalized,
      [round.key]: [...current, teamId],
    });
  }

  const next = { ...normalized };
  for (const round of ADVANCEMENT_ROUNDS.slice(roundIndex)) {
    next[round.key] = (next[round.key] ?? []).filter((id) => id !== teamId);
  }
  return normalizeKnockoutPicks(next);
}

function buildRows(grupos, standingsPredictionsByMatchId) {
  return Object.entries(grupos ?? {})
    .sort(([a], [b]) => a.localeCompare(b, "es"))
    .flatMap(([groupId, grupo]) =>
      calculateStandings(grupo, standingsPredictionsByMatchId, {
        fallbackToPartidoResultado: false,
      }).map((equipo, index) => ({
        ...equipo,
        groupId,
        groupLabel: groupId,
        groupPosition: index + 1,
      })),
    );
}

export default function EliminatoriasView({
  grupos,
  knockoutPicks,
  standingsPredictionsByMatchId,
  predictionsLocked,
  onToggleAdvancement,
  onSave,
  isDirty = false,
  isSaving = false,
  updatedAt = null,
}) {
  const rows = useMemo(
    () => buildRows(grupos, standingsPredictionsByMatchId),
    [grupos, standingsPredictionsByMatchId],
  );

  const normalizedPicks = useMemo(() => normalizeKnockoutPicks(knockoutPicks), [knockoutPicks]);

  const selectedByRound = useMemo(() => {
    const next = {};
    for (const round of ADVANCEMENT_ROUNDS) {
      next[round.key] = new Set(normalizedPicks[round.key] ?? []);
    }
    return next;
  }, [normalizedPicks]);

  const updatedLabel = updatedAt
    ? `Guardado ${new Date(updatedAt).toLocaleString("es-ES")}`
    : "Sin guardar";

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-black tracking-tight">Eliminatorias</h2>
          <p className="max-w-3xl text-sm text-slate-300">
            Marca los equipos que avanzan ronda a ronda desde tu clasificacion de grupos.
          </p>
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          <Button
            onClick={onSave}
            disabled={predictionsLocked || isSaving || !isDirty}
            className="w-full md:w-auto"
          >
            {isSaving ? "Guardando..." : "Guardar datos"}
          </Button>
          <div className="text-xs font-semibold text-slate-400">{updatedLabel}</div>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b border-slate-800 bg-slate-950/50 p-3 text-xs font-black text-slate-200">
          {ADVANCEMENT_ROUNDS.map((round) => (
            <span
              key={round.key}
              className="rounded-lg bg-slate-900/80 px-2.5 py-1 ring-1 ring-slate-700/70"
            >
              {selectedByRound[round.key]?.size ?? 0}/{round.limit} {round.label}
            </span>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-xs font-black tracking-wide text-slate-300">
                <th className="w-20 p-3 text-left">GRUPO</th>
                <th className="min-w-64 p-3 text-left">EQUIPO</th>
                {ADVANCEMENT_ROUNDS.map((round) => (
                  <th key={round.key} className="w-24 p-3 text-center">
                    {round.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((team) => (
                <tr
                  key={team.id}
                  className="border-b border-slate-900/80 transition hover:bg-slate-900/70"
                >
                  <td className="p-3 font-black text-slate-200">
                    <span className="inline-flex min-w-14 justify-center rounded-lg bg-slate-900 px-2 py-1 ring-1 ring-slate-700/70">
                      {team.groupLabel}
                    </span>
                  </td>
                  <td className="p-3 font-semibold text-white">
                    <span className="inline-flex items-center gap-2">
                      <Flag team={team} className="h-4 w-4" />
                      {team.nombre}
                    </span>
                  </td>
                  {ADVANCEMENT_ROUNDS.map((round) => {
                    const selected = selectedByRound[round.key]?.has(team.id) ?? false;
                    const previousSelected =
                      !round.previousKey || selectedByRound[round.previousKey]?.has(team.id);
                    const roundFull =
                      !selected && (selectedByRound[round.key]?.size ?? 0) >= round.limit;
                    const disabled = predictionsLocked || (!selected && (!previousSelected || roundFull));
                    const title = predictionsLocked
                      ? "Pronosticos bloqueados"
                      : selected
                        ? "Desmarcar"
                        : !previousSelected
                          ? "Debe pasar la ronda anterior"
                          : roundFull
                            ? `Maximo ${round.limit} equipos`
                            : "Marcar";

                    return (
                      <td key={round.key} className="p-2 text-center">
                        <button
                          type="button"
                          className={`mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-sm font-black transition ring-1 ${
                            selected
                              ? "bg-emerald-400 text-slate-950 ring-emerald-200"
                              : disabled
                                ? "bg-slate-900/40 text-slate-700 ring-slate-800"
                                : "bg-slate-950 text-slate-300 ring-slate-700 hover:bg-slate-800 hover:text-white"
                          }`}
                          aria-pressed={selected}
                          title={title}
                          disabled={disabled}
                          onClick={() => onToggleAdvancement(round.key, team.id, !selected)}
                        >
                          {selected ? "X" : ""}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
