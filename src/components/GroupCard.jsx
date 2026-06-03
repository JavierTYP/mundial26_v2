import StandingsTable from "./StandingsTable.jsx";
import MatchRow from "./MatchRow.jsx";

function matchdayDateLabel(partidos) {
  const dates = [
    ...new Set(
      partidos
        .map((p) => (typeof p.fecha === "string" ? p.fecha.trim() : ""))
        .filter(Boolean),
    ),
  ].sort();

  if (dates.length === 0) return null;
  if (dates.length === 1) return dates[0];
  return `${dates[0]} – ${dates[dates.length - 1]}`;
}

export default function GroupCard({
  grupo,
  onUpdateMatch,
  mode = "results",
  predictionsByMatchId = {},
  standingsResultsByMatchId = null,
  onUpdatePrediction,
  onUpdatePredictionDraft,
  predictionsLocked = false,
  resultsReadOnly = false,
}) {
  const byId = new Map(grupo.equipos.map((e) => [e.id, e]));
  const matchdays = [1, 2, 3];

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xl font-black">Tabla de posiciones</h3>
          <div className="text-xs text-slate-400">Orden: PTS → DG → GF</div>
        </div>
        <StandingsTable
          grupo={grupo}
          highlightTop2
          resultsByMatchId={mode === "predictions" ? standingsResultsByMatchId : null}
          fallbackToPartidoResultado={mode !== "predictions"}
        />
      </div>

      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black">
            {mode === "predictions" ? "Mis pronósticos" : "Resultados"}
          </h3>
          <div className="text-xs text-slate-400">
            {mode === "predictions" ? "0–10 goles, guardado automático" : "0–10 goles, Enter para guardar"}
          </div>
        </div>

        {matchdays.map((md) => {
          const partidos = grupo.partidos.filter((p) => p.matchday === md);
          if (partidos.length === 0) return null;
          const dateLabel = matchdayDateLabel(partidos);
          return (
            <div key={md} className="space-y-3">
              <div className="text-sm font-bold text-slate-200">
                <span>Matchday {md}</span>
                {dateLabel ? (
                  <span className="ml-2 font-semibold text-slate-400">
                    · {dateLabel}
                  </span>
                ) : null}
              </div>
              <div className="grid gap-3">
                {partidos.map((p) => (
                  <MatchRow
                    key={p.id}
                    partido={p}
                    equipoLocal={byId.get(p.idLocal)}
                    equipoVisitante={byId.get(p.idVisitante)}
                    resultado={mode === "predictions" ? predictionsByMatchId?.[p.id] ?? null : null}
                    fallbackToPartidoResultado={mode !== "predictions"}
                    readOnly={
                      mode === "predictions" ? predictionsLocked : Boolean(resultsReadOnly)
                    }
                    saveLabel={mode === "predictions" ? "Guardar" : "Actualizar"}
                    autoSave={mode === "predictions"}
                    onUpdate={(l, v) => {
                      if (mode === "predictions") onUpdatePrediction?.(p.id, l, v);
                      else onUpdateMatch(grupo.id, p.id, l, v);
                    }}
                    onDraft={
                      mode === "predictions"
                        ? (l, v) => onUpdatePredictionDraft?.(p.id, l, v)
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
