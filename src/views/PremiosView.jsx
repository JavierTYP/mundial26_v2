import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import { apiScoreboard } from "../utils/api.js";

function displayParticipant(row) {
  return row?.nick?.trim() ? row.nick.trim() : row?.email ?? "-";
}

export default function PremiosView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void apiScoreboard(null)
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const participants = data?.rows ?? [];
  const participantCount = participants.length;
  const total = participantCount * 5;

  const winners = useMemo(() => {
    const rows = Array.isArray(participants) ? participants : [];
    return [rows[0] ?? null, rows[1] ?? null, rows[2] ?? null];
  }, [participants]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight">Ganadores</h2>
        <p className="text-sm text-slate-300">
          Clasificación final y ganadores.
          <br />
          70% para el ganador
          <br />
          20% para el segundo
          <br />
          10% para el tercero
        </p>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-300">
              Recaudación
            </div>
            <div className="mt-2 text-sm text-slate-200">
              Nº participantes:{" "}
              <span className="font-black text-slate-100">
                {loading ? "…" : participantCount}
              </span>{" "}
              × 5€ =&gt;{" "}
              <span className="font-black text-blue-200">
                {loading ? "…" : `${total}€`}
              </span>
            </div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-300">
              Ganadores
            </div>
            <div className="mt-2 grid gap-1 text-sm text-slate-200">
              <div>
                <span className="inline-flex items-center gap-1 font-black text-slate-100">
                  1er. ganador{" "}
                  <span role="img" aria-label="Medalla de oro">
                    🥇
                  </span>
                </span>{" "}
                =&gt; {displayParticipant(winners[0])}{" "}
                <span className="text-slate-400">
                  {winners[0] ? `(${winners[0].points} pts)` : ""}
                </span>
              </div>
              <div>
                <span className="inline-flex items-center gap-1 font-black text-slate-100">
                  2do. ganador{" "}
                  <span role="img" aria-label="Medalla de plata">
                    🥈
                  </span>
                </span>{" "}
                =&gt; {displayParticipant(winners[1])}{" "}
                <span className="text-slate-400">
                  {winners[1] ? `(${winners[1].points} pts)` : ""}
                </span>
              </div>
              <div>
                <span className="inline-flex items-center gap-1 font-black text-slate-100">
                  3er. ganador{" "}
                  <span role="img" aria-label="Medalla de bronce">
                    🥉
                  </span>
                </span>{" "}
                =&gt; {displayParticipant(winners[2])}{" "}
                <span className="text-slate-400">
                  {winners[2] ? `(${winners[2].points} pts)` : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs font-black uppercase tracking-wide text-slate-300">
                <th className="px-4 py-3">POSICIÓN</th>
                <th className="px-4 py-3">PARTICIPANTE</th>
                <th className="px-4 py-3 text-center">PUNTOS</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((r, idx) => (
                <tr key={r.email} className="border-t border-slate-800">
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">{idx + 1}</td>
                  <td className="px-4 py-3 font-semibold text-slate-100">
                    {displayParticipant(r)}
                  </td>
                  <td className="px-4 py-3 text-center font-black text-blue-200">
                    {r.points}
                  </td>
                </tr>
              ))}
              {!loading && !participants.length ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-slate-300" colSpan={3}>
                    No hay participantes todavía.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
