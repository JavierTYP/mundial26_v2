import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import { apiScoreboard } from "../utils/api.js";

export default function ScoreboardView({ grupos }) {
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

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight">Puntuaciones</h2>
        <p className="text-sm text-slate-300">
          0 pts si no acierta ganador; 1 pt si acierta ganador/empate; 4 pts si acierta marcador exacto.
          <br />
          +10 puntos por 'Bal&#243;n de oro'.
          <br />
          +10 puntos por 'Bota de oro'.
          <br />
          +10 puntos por 'Gualte de oro'.
        </p>
      </div>

      <Card className="p-4">
        <div className="text-xs font-bold uppercase tracking-wide text-slate-300">Partidos</div>
        <div className="mt-2 text-xs text-slate-400">
          {loading ? "Cargando..." : `Partidos con resultado real: ${data?.playedMatches ?? 0}`}
        </div>
      </Card>

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-xs font-black uppercase tracking-wide text-slate-300">
                <th className="px-4 py-3">POSICIÓN</th>
                <th className="px-4 py-3">NICK</th>
                <th className="px-4 py-3 text-center">ACIERTOS (con resultado)</th>
                <th className="px-4 py-3 text-center">ACIERTOS (sin resultado)</th>
                <th className="px-4 py-3 text-center">Bota de oro</th>
                <th className="px-4 py-3 text-center">Balón de oro</th>
                <th className="px-4 py-3 text-center">Guante de oro</th>
                <th className="px-4 py-3 text-center">PUNTOS TOTALES</th>
              </tr>
            </thead>
            <tbody>
              {(data?.rows ?? []).map((r, idx) => (
                <tr key={r.email} className="border-t border-slate-800">
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">{idx + 1}</td>
                  <td className="px-4 py-3 font-semibold text-slate-100">{r.nick ?? "-"}</td>
                  <td className="px-4 py-3 text-center font-black text-slate-100">
                    {r.exactHits} <span className="text-xs font-semibold text-slate-500">(x4)</span>
                  </td>
                  <td className="px-4 py-3 text-center font-black text-slate-100">
                    {r.outcomeHits} <span className="text-xs font-semibold text-slate-500">(x1)</span>
                  </td>
                  <td className="px-4 py-3 text-center font-black">
                    {r.botaDeOroPoints ? (
                      <span className="text-emerald-200">+{r.botaDeOroPoints}</span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-black">
                    {r.balonDeOroPoints ? (
                      <span className="text-emerald-200">+{r.balonDeOroPoints}</span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-black">
                    {r.guanteDeOroPoints ? (
                      <span className="text-emerald-200">+{r.guanteDeOroPoints}</span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-black text-blue-200">{r.points}</td>
                </tr>
              ))}
              {!loading && !(data?.rows?.length) ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-slate-300" colSpan={8}>
                    No hay datos (aún no hay resultados reales o no hay usuarios).
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
