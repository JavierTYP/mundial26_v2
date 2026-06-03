import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import Badge from "../components/Badge.jsx";
import Button from "../components/Button.jsx";
import Flag from "../components/Flag.jsx";
import { winnerId } from "../utils/knockout.js";

function clampGoals(value) {
  if (value === "" || value == null) return null;
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(10, n));
}

function buildTeamsIndex(grupos) {
  const map = new Map();
  for (const g of Object.values(grupos)) {
    for (const e of g.equipos) map.set(e.id, e);
  }
  return map;
}

function MatchCard({ match, teamsById, disabled, onSave }) {
  const localTeam = match.local ? teamsById.get(match.local) : null;
  const awayTeam = match.visitante ? teamsById.get(match.visitante) : null;

  const [local, setLocal] = useState(match.resultado?.local ?? "");
  const [visitante, setVisitante] = useState(match.resultado?.visitante ?? "");
  const [pickedWinner, setPickedWinner] = useState(match.ganador ?? "");

  useEffect(() => {
    setLocal(match.resultado?.local ?? "");
    setVisitante(match.resultado?.visitante ?? "");
    setPickedWinner(match.ganador ?? "");
  }, [
    match.id,
    match.resultado?.local,
    match.resultado?.visitante,
    match.ganador,
    match.local,
    match.visitante,
  ]);

  const l = clampGoals(local);
  const v = clampGoals(visitante);
  const canSave = !disabled && l != null && v != null;
  const isTie = canSave && l === v;
  const canPickWinner = isTie && localTeam && awayTeam;

  const winner = winnerId({
    ...match,
    resultado: { local: l, visitante: v },
    ganador: pickedWinner || null,
  });

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-black">{match.id}</div>
        {match.emparejamiento ? <Badge tone="neutral">{match.emparejamiento}</Badge> : null}
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-[1fr_auto_1fr] min-[420px]:items-center min-[420px]:gap-3">
          <div className="min-w-0 truncate rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-semibold">
            {localTeam ? (
              <>
                <span className="mr-2 inline-flex">
                  <Flag team={localTeam} className="h-4 w-4" />
                </span>
                {localTeam.nombre}
              </>
            ) : (
              <span className="text-slate-500">Por definir</span>
            )}
          </div>

          <div className="flex items-center justify-center gap-2">
            <input
              disabled={disabled || !localTeam || !awayTeam}
              className="w-14 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-center font-black outline-none ring-blue-500/30 focus:ring-2 disabled:opacity-40"
              type="number"
              min={0}
              max={10}
              value={local}
              onChange={(e) => setLocal(e.target.value)}
            />
            <span className="text-slate-500">-</span>
            <input
              disabled={disabled || !localTeam || !awayTeam}
              className="w-14 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-center font-black outline-none ring-blue-500/30 focus:ring-2 disabled:opacity-40"
              type="number"
              min={0}
              max={10}
              value={visitante}
              onChange={(e) => setVisitante(e.target.value)}
            />
          </div>

          <div className="min-w-0 truncate rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-right text-sm font-semibold">
            {awayTeam ? (
              <>
                {awayTeam.nombre}
                <span className="ml-2 inline-flex">
                  <Flag team={awayTeam} className="h-4 w-4" />
                </span>
              </>
            ) : (
              <span className="text-slate-500">Por definir</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-slate-400">
            {disabled
              ? "Resultados bloqueados."
              : isTie
                ? "En caso de empate, elije ganador."
                : winner
                  ? `Ganador: ${teamsById.get(winner)?.nombre ?? winner}`
                  : "Completa el resultado para avanzar."}
          </div>
          <Button
            variant="secondary"
            disabled={!canSave || (isTie && !winner)}
            onClick={() => onSave(l, v, winner ?? null)}
          >
            Guardar
          </Button>
        </div>

        {canPickWinner ? (
          <div className="pt-1">
            <label className="mb-1 block text-xs font-semibold text-slate-300">En caso de empate</label>
            <select
              disabled={disabled}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm font-semibold outline-none ring-blue-500/30 focus:ring-2 disabled:opacity-40"
              value={pickedWinner}
              onChange={(e) => setPickedWinner(e.target.value)}
            >
              <option value="">Elije ganador</option>
              <option value={match.local}>{localTeam?.nombre ?? String(match.local)}</option>
              <option value={match.visitante}>{awayTeam?.nombre ?? String(match.visitante)}</option>
            </select>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export default function KnockoutRoundView({
  torneo,
  title,
  roundKey,
  matches,
  onUpdateRoundMatch,
  onUpdateFinal,
  disabled = false,
}) {
  const teamsById = useMemo(() => buildTeamsIndex(torneo.grupos), [torneo.grupos]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight">{title}</h2>
        <p className="text-sm text-slate-300">
          Ingresa resultados y avanza automáticamente en el cuadro.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {matches.map((m) => (
          <MatchCard
            key={m.id}
            match={m}
            teamsById={teamsById}
            disabled={disabled}
            onSave={(l, v, winner) => {
              if (roundKey === "final") onUpdateFinal(m.id, l, v, winner);
              else onUpdateRoundMatch(roundKey, m.id, l, v, winner);
            }}
          />
        ))}
      </div>
    </section>
  );
}
