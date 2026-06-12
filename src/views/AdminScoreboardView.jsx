import { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import { apiAdminScoreboard } from "../utils/api.js";

const KNOCKOUT_SCORE_COLUMNS = [
  { key: "16avos", label: "16avos", multiplier: 1 },
  { key: "8avos", label: "8avos", multiplier: 2 },
  { key: "4tos", label: "4tos", multiplier: 4 },
  { key: "semis", label: "Semis", multiplier: 6 },
  { key: "final", label: "Final", multiplier: 10 },
  { key: "campeon", label: "Campeón", multiplier: 20 },
];

export default function AdminScoreboardView({ grupos: _grupos } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void apiAdminScoreboard(null)
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
        <h2 className="text-2xl font-black tracking-tight">Puntuaciones (admin)</h2>
        <p className="text-sm text-slate-300">
          Vista de administración del ranking (mismos puntos, con endpoint admin).
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
          <table className="min-w-[1120px] w-full table-fixed border-separate border-spacing-0 text-sm">
            <colgroup>
              <col className="w-20" />
              <col className="w-40" />
              <col className="w-24" />
              <col className="w-28" />
              <col className="w-28" />
              <col className="w-24" />
              <col className="w-24" />
              <col className="w-24" />
              {KNOCKOUT_SCORE_COLUMNS.map((column) => (
                <col key={column.key} className={column.key === "campeon" ? "w-24" : "w-20"} />
              ))}
            </colgroup>
            <thead>
              <tr className="text-left text-xs font-black uppercase tracking-wide text-slate-300">
                <th className="px-3 py-3">POSICIÓN</th>
                <th className="px-3 py-3">NICK</th>
                <th className="px-3 py-3 text-center">TOTALES</th>
                <th className="px-3 py-3 text-center leading-tight">ACIERTOS (con resultado)</th>
                <th className="px-3 py-3 text-center leading-tight">ACIERTOS (sin resultado)</th>
                <th className="px-3 py-3 text-center leading-tight">Bota de oro</th>
                <th className="px-3 py-3 text-center leading-tight">BalÃ³n de oro</th>
                <th className="px-3 py-3 text-center leading-tight">Guante de oro</th>
                {KNOCKOUT_SCORE_COLUMNS.map((column) => (
                  <th key={column.key} className="px-3 py-3 text-center leading-tight">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.rows ?? []).map((r, idx) => (
                <tr key={r.email} className="border-t border-slate-800">
                  <td className="px-3 py-3 font-mono text-xs text-slate-300">{idx + 1}</td>
                  <td className="truncate px-3 py-3 font-semibold text-slate-100">{r.nick ?? "-"}</td>
                  <td className="px-3 py-3 text-center font-black text-blue-200">{r.points}</td>
                  <td className="px-3 py-3 text-center font-black text-slate-100">
                    {r.exactHits} <span className="text-xs font-semibold text-slate-500">(x4)</span>
                  </td>
                  <td className="px-3 py-3 text-center font-black text-slate-100">
                    {r.outcomeHits} <span className="text-xs font-semibold text-slate-500">(x1)</span>
                  </td>
                  <td className="px-3 py-3 text-center font-black">
                    {r.botaDeOroPoints ? (
                      <span className="text-emerald-200">+{r.botaDeOroPoints}</span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center font-black">
                    {r.balonDeOroPoints ? (
                      <span className="text-emerald-200">+{r.balonDeOroPoints}</span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center font-black">
                    {r.guanteDeOroPoints ? (
                      <span className="text-emerald-200">+{r.guanteDeOroPoints}</span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  {KNOCKOUT_SCORE_COLUMNS.map((column) => (
                    <td key={column.key} className="px-3 py-3 text-center font-black text-slate-100">
                      {r.knockoutHits?.[column.key] ?? 0}{" "}
                      <span className="text-xs font-semibold text-slate-500">
                        (x{column.multiplier})
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
              {!loading && !(data?.rows?.length) ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-slate-300" colSpan={14}>
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
