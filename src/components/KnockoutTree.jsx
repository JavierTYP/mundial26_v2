import Card from "./Card.jsx";
import Badge from "./Badge.jsx";
import Button from "./Button.jsx";
import { useEffect, useMemo, useState } from "react";
import { winnerId } from "../utils/knockout.js";
import Flag from "./Flag.jsx";

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

function MatchCard({ title, match, teamsById, disabled, onSave }) {
  const localTeam = match.local ? teamsById.get(match.local) : null;
  const awayTeam = match.visitante ? teamsById.get(match.visitante) : null;

  const [local, setLocal] = useState(match.resultado?.local ?? "");
  const [visitante, setVisitante] = useState(match.resultado?.visitante ?? "");

  useEffect(() => {
    setLocal(match.resultado?.local ?? "");
    setVisitante(match.resultado?.visitante ?? "");
  }, [match.id, match.resultado?.local, match.resultado?.visitante, match.local, match.visitante]);

  const l = clampGoals(local);
  const v = clampGoals(visitante);
  const canSave = !disabled && l != null && v != null;
  const isTie = canSave && l === v;

  const winner = winnerId({
    ...match,
    resultado: { local: l, visitante: v },
  });

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-black">{title}</div>
        {match.emparejamiento && <Badge tone="neutral">{match.emparejamiento}</Badge>}
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
            {isTie
              ? "Empate no permitido (elige un ganador)."
              : winner
                ? `Ganador: ${teamsById.get(winner)?.nombre ?? winner}`
                : "Completa el resultado para avanzar."}
          </div>
          <Button variant="secondary" disabled={!canSave || isTie} onClick={() => onSave(l, v)}>
            Guardar
          </Button>
        </div>
      </div>
    </Card>
  );
}

function RoundColumn({ title, matches, teamsById, disabled, onSaveMatch }) {
  return (
    <div className="w-[360px] shrink-0 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-black text-slate-100">{title}</div>
        <Badge tone={disabled ? "neutral" : "blue"}>{matches.length}</Badge>
      </div>
      {matches.map((m) => (
        <MatchCard
          key={m.id}
          title={m.id}
          match={m}
          teamsById={teamsById}
          disabled={disabled}
          onSave={(l, v) => onSaveMatch(m.id, l, v)}
        />
      ))}
    </div>
  );
}

export default function KnockoutTree({ torneo, onUpdateRoundMatch, onUpdateFinal }) {
  const teamsById = useMemo(() => buildTeamsIndex(torneo.grupos), [torneo.grupos]);

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 pb-2">
        <RoundColumn
          title="16avos"
          matches={torneo.dieciseisavos ?? []}
          teamsById={teamsById}
          disabled={false}
          onSaveMatch={(id, l, v) => onUpdateRoundMatch("dieciseisavos", id, l, v)}
        />
        <RoundColumn
          title="Octavos"
          matches={torneo.octavos ?? []}
          teamsById={teamsById}
          disabled={false}
          onSaveMatch={(id, l, v) => onUpdateRoundMatch("octavos", id, l, v)}
        />
        <RoundColumn
          title="Cuartos"
          matches={torneo.cuartos ?? []}
          teamsById={teamsById}
          disabled={false}
          onSaveMatch={(id, l, v) => onUpdateRoundMatch("cuartos", id, l, v)}
        />
        <RoundColumn
          title="Semifinales"
          matches={torneo.semifinales ?? []}
          teamsById={teamsById}
          disabled={false}
          onSaveMatch={(id, l, v) => onUpdateRoundMatch("semifinales", id, l, v)}
        />

        <div className="w-[360px] shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-black text-slate-100">Final</div>
            <Badge tone="blue">1</Badge>
          </div>
          <MatchCard
            title={torneo.final.id}
            match={torneo.final}
            teamsById={teamsById}
            disabled={false}
            onSave={(l, v) => onUpdateFinal(l, v)}
          />
        </div>
      </div>
    </div>
  );
}
